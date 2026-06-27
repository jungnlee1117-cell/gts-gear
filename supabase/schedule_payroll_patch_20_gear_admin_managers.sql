-- 양의인(레이첼)·오정석(마이크) — 교구 시스템 관리자(대여/반납/예약 승인)
-- Supabase SQL Editor에서 실행
--
-- schedule_payroll_patch_17_item_admin.sql 적용 후 실행 권장

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
      AND (t.role = 'superadmin' OR t.is_item_admin = true)
  );
$$;

UPDATE public.teachers
SET is_item_admin = true
WHERE name IN ('양의인', '오정석');

-- 예약 RLS — is_item_admin() 기준으로 통일 (스케줄 admin만으로는 승인 불가)
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
