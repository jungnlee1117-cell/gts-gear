-- 교구 전체 수량(total_quantity) 즉시 수정 + 이력 + 관리자 전용 공지
-- Supabase SQL Editor에서 실행

-- ─────────────────────────────────────────────
-- 1) 이력 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_quantity_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  old_quantity integer NOT NULL CHECK (old_quantity >= 0),
  new_quantity integer NOT NULL CHECK (new_quantity >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.item_quantity_adjustments IS
  '교구 전체 보유 수량(total_quantity) 변경 이력. 승인 없이 즉시 반영되며 RPC로만 삽입.';
COMMENT ON COLUMN public.item_quantity_adjustments.old_quantity IS '수정 전 items.total_quantity';
COMMENT ON COLUMN public.item_quantity_adjustments.new_quantity IS '수정 후 items.total_quantity';
COMMENT ON COLUMN public.item_quantity_adjustments.note IS '사유(파손·분실·실사 등). 선택.';

CREATE INDEX IF NOT EXISTS item_quantity_adjustments_created_idx
  ON public.item_quantity_adjustments (created_at DESC);
CREATE INDEX IF NOT EXISTS item_quantity_adjustments_item_idx
  ON public.item_quantity_adjustments (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS item_quantity_adjustments_teacher_idx
  ON public.item_quantity_adjustments (teacher_id, created_at DESC);

ALTER TABLE public.item_quantity_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.item_quantity_adjustments FROM PUBLIC;
REVOKE ALL ON public.item_quantity_adjustments FROM anon;
GRANT SELECT ON public.item_quantity_adjustments TO authenticated;
GRANT ALL ON public.item_quantity_adjustments TO service_role;

DROP POLICY IF EXISTS "item_qty_adj_select_admin" ON public.item_quantity_adjustments;
CREATE POLICY "item_qty_adj_select_admin" ON public.item_quantity_adjustments
  FOR SELECT TO authenticated
  USING (public.is_item_admin());

-- INSERT/UPDATE/DELETE 정책 없음 — 클라이언트 직접 쓰기는 막고 RPC(SECURITY DEFINER)만 사용

-- ─────────────────────────────────────────────
-- 2) notices.audience_type = item_admins
-- ─────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.notices') IS NULL THEN
    RAISE NOTICE 'public.notices 없음 — audience_type 패치 스킵';
    RETURN;
  END IF;

  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.notices'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%audience_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notices DROP CONSTRAINT %I', r.conname);
  END LOOP;

  ALTER TABLE public.notices
    ADD CONSTRAINT notices_audience_type_check
    CHECK (audience_type IN (
      'all',
      'teachers',
      'institution_teachers',
      'specific',
      'item_admins',
      'schedule_admins'
    ));

  COMMENT ON COLUMN public.notices.audience_type IS
    'all=전체, teachers=선생님만, institution_teachers=특정 기관 선생님, specific=지정 선생님, item_admins=교구관리자, schedule_admins=스케줄 관리자';

  DROP POLICY IF EXISTS "notices_select" ON public.notices;
  CREATE POLICY "notices_select" ON public.notices
    FOR SELECT TO authenticated
    USING (
      (
        audience_type = 'item_admins'
        AND public.is_item_admin()
      )
      OR (
        audience_type = 'schedule_admins'
        AND public.is_schedule_admin()
      )
      OR (
        audience_type IS DISTINCT FROM 'item_admins'
        AND audience_type IS DISTINCT FROM 'schedule_admins'
        AND (
          public.is_schedule_superadmin()
          OR author_id = auth.uid()
          OR audience_type = 'all'
          OR (
            audience_type = 'teachers'
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.id = auth.uid()
                AND t.role = 'teacher'
            )
          )
          OR (
            audience_type = 'institution_teachers'
            AND institution_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.id = auth.uid()
                AND t.role = 'teacher'
            )
            AND (
              EXISTS (
                SELECT 1
                FROM public.institution_teacher_assignments a
                WHERE a.institution_id = notices.institution_id
                  AND a.teacher_id = auth.uid()
                  AND a.is_active = true
              )
              OR EXISTS (
                SELECT 1
                FROM public.institution_weekly_schedule w
                WHERE w.institution_id = notices.institution_id
                  AND w.teacher_id = auth.uid()
              )
            )
          )
          OR (
            audience_type = 'specific'
            AND auth.uid() = ANY (audience_teacher_ids)
          )
        )
      )
    );
END $$;

-- ─────────────────────────────────────────────
-- 3) 재고 변경 + 이력을 한 트랜잭션으로
--    (공지는 notices에 쌓지 않음. 허브/공지 피드의 고정 카드가 이력을 조회)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.adjust_item_total_quantity(
  p_item_id uuid,
  p_new_quantity integer,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher public.teachers%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_old integer;
  v_note text;
  v_adjustment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_teacher
  FROM public.teachers
  WHERE id = auth.uid();

  IF v_teacher.id IS NULL OR COALESCE(v_teacher.active, true) = false THEN
    RAISE EXCEPTION '활성 선생님 계정만 수정할 수 있습니다.';
  END IF;

  IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
    RAISE EXCEPTION '수량은 0 이상이어야 합니다.';
  END IF;

  SELECT * INTO v_item
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION '교구를 찾을 수 없습니다.';
  END IF;

  v_old := COALESCE(v_item.total_quantity, 0);
  IF v_old = p_new_quantity THEN
    RAISE EXCEPTION '수량이 이전과 같습니다.';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  UPDATE public.items
  SET total_quantity = p_new_quantity
  WHERE id = p_item_id;

  INSERT INTO public.item_quantity_adjustments (
    item_id, teacher_id, old_quantity, new_quantity, note
  ) VALUES (
    p_item_id, v_teacher.id, v_old, p_new_quantity, v_note
  )
  RETURNING id INTO v_adjustment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'old_quantity', v_old,
    'new_quantity', p_new_quantity,
    'total_quantity', p_new_quantity,
    'adjustment_id', v_adjustment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_item_total_quantity(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_item_total_quantity(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_item_total_quantity(uuid, integer, text) TO service_role;

COMMENT ON FUNCTION public.adjust_item_total_quantity(uuid, integer, text) IS
  'items.total_quantity 즉시 수정 + 이력을 한 트랜잭션으로 처리. 공지 행은 만들지 않음.';
