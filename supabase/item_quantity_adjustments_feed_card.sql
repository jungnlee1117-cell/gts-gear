-- 재고 변경 시 notices 행을 더 이상 만들지 않음.
-- 기존 개별 재고변경 공지는 삭제 (이력 테이블이 단일 소스).
-- Supabase SQL Editor 또는 `npx supabase db query --linked -f ...` 로 실행

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

COMMENT ON FUNCTION public.adjust_item_total_quantity(uuid, integer, text) IS
  'items.total_quantity 즉시 수정 + 이력을 한 트랜잭션으로 처리. 공지 행은 만들지 않음.';

DELETE FROM public.notices
WHERE audience_type = 'item_admins'
   OR COALESCE(body_style->>'source', '') = 'item_quantity_adjust';
