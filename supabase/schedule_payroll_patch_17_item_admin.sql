-- 교구 시스템 전용 관리자 플래그 (스케줄 role 과 분리)
-- Supabase SQL Editor에서 실행
--
-- notices 테이블이 없어도 is_item_admin() 까지는 적용됩니다.
-- 공지 RLS 갱신은 notices 테이블 생성 후 이 파일을 다시 실행하거나
-- supabase/notices.sql 실행 시 is_item_admin() 정책으로 덮어씁니다.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS is_item_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teachers.is_item_admin IS
  '교구(대여/반납) 관리자 — role=teacher 여도 true면 교구 관리 메뉴';

CREATE OR REPLACE FUNCTION public.is_item_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid()
      AND COALESCE(t.active, true)
      AND (t.role IN ('admin', 'superadmin') OR t.is_item_admin = true)
  );
$$;

-- notices (테이블 있을 때만 — 없으면 스킵)
DO $$
BEGIN
  IF to_regclass('public.notices') IS NOT NULL THEN
    DROP POLICY IF EXISTS "notices_insert_admin" ON public.notices;
    CREATE POLICY "notices_insert_admin" ON public.notices
      FOR INSERT TO authenticated
      WITH CHECK (public.is_item_admin());

    DROP POLICY IF EXISTS "notices_update_admin" ON public.notices;
    CREATE POLICY "notices_update_admin" ON public.notices
      FOR UPDATE TO authenticated
      USING (public.is_item_admin())
      WITH CHECK (public.is_item_admin());
  ELSE
    RAISE NOTICE 'public.notices 없음 — 공지 RLS 정책 스킵 (supabase/notices.sql 실행 후 재적용)';
  END IF;
END $$;

-- reservations
DO $$
BEGIN
  IF to_regclass('public.reservations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
    CREATE POLICY "reservations_select" ON public.reservations
      FOR SELECT TO authenticated
      USING (
        teacher_id = auth.uid()
        OR public.is_item_admin()
      );

    DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
    CREATE POLICY "reservations_update" ON public.reservations
      FOR UPDATE TO authenticated
      USING (
        (teacher_id = auth.uid() AND status = 'pending')
        OR public.is_item_admin()
      );
  END IF;
END $$;

-- resources
DO $$
BEGIN
  IF to_regclass('public.resources') IS NOT NULL THEN
    DROP POLICY IF EXISTS "resources_insert_admin" ON public.resources;
    CREATE POLICY "resources_insert_admin" ON public.resources
      FOR INSERT TO authenticated
      WITH CHECK (public.is_item_admin());

    DROP POLICY IF EXISTS "resources_update_admin" ON public.resources;
    CREATE POLICY "resources_update_admin" ON public.resources
      FOR UPDATE TO authenticated
      USING (public.is_item_admin())
      WITH CHECK (public.is_item_admin());

    DROP POLICY IF EXISTS "resources_delete_superadmin" ON public.resources;
    CREATE POLICY "resources_delete_superadmin" ON public.resources
      FOR DELETE TO authenticated
      USING (public.is_item_admin());
  END IF;
END $$;

-- 오주영: 교구 관리자만, 스케줄은 강사
UPDATE public.teachers
SET role = 'teacher', is_item_admin = true
WHERE name = '오주영';
