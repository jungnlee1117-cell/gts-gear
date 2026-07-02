-- schedule_change_notifications RLS 수정
-- Supabase SQL Editor에서 실행
--
-- 증상: payrollSaveWithNotification → createScheduleChangeNotification INSERT 후 403
-- 원인:
--   1) 강사 INSERT는 허용되나 SELECT 정책이 관리자 전용 → .insert().select() 반환 실패
--   2) 슈퍼관리자/관리자가 다른 강사 대리 입력 시 teacher_id ≠ auth.uid() → INSERT 거부
--
-- schedule_payroll_patch_10_schedule_change_notifications.sql 적용 후 실행
-- schedule_payroll_patch_16_manager_scope_rls.sql (is_schedule_superadmin 등) 적용 권장

DO $$
BEGIN
  IF to_regclass('public.schedule_change_notifications') IS NULL THEN
    RAISE NOTICE 'public.schedule_change_notifications 없음 — patch 10 먼저 실행';
    RETURN;
  END IF;

  ALTER TABLE public.schedule_change_notifications ENABLE ROW LEVEL SECURITY;

  -- 본인 알림 조회 (INSERT … RETURNING / select().single() 용)
  DROP POLICY IF EXISTS "schedule_change_teacher_read_own" ON public.schedule_change_notifications;
  CREATE POLICY "schedule_change_teacher_read_own" ON public.schedule_change_notifications
    FOR SELECT TO authenticated
    USING (teacher_id = auth.uid());

  -- 강사 본인 알림 생성
  DROP POLICY IF EXISTS "schedule_change_teacher_insert" ON public.schedule_change_notifications;
  CREATE POLICY "schedule_change_teacher_insert" ON public.schedule_change_notifications
    FOR INSERT TO authenticated
    WITH CHECK (teacher_id = auth.uid());

  -- 관리자 대리 생성 (슈퍼관리자 전체 · 지역 관리자 담당 강사)
  DROP POLICY IF EXISTS "schedule_change_admin_insert" ON public.schedule_change_notifications;
  IF to_regprocedure('public.is_schedule_superadmin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "schedule_change_admin_insert" ON public.schedule_change_notifications
        FOR INSERT TO authenticated
        WITH CHECK (
          public.is_schedule_superadmin()
          OR (
            public.is_schedule_regional_manager()
            AND public.teacher_at_managed_institution(teacher_id)
          )
        )
    $policy$;
  ELSIF to_regprocedure('public.is_schedule_admin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "schedule_change_admin_insert" ON public.schedule_change_notifications
        FOR INSERT TO authenticated
        WITH CHECK (public.is_schedule_admin())
    $policy$;
  ELSE
    RAISE NOTICE 'is_schedule_superadmin / is_schedule_admin 없음 — 관리자 INSERT 정책 스킵';
  END IF;

  -- 관리자 조회·읽음 처리 (patch 16 스코프 유지, 없으면 is_schedule_admin 폴백)
  DROP POLICY IF EXISTS "schedule_change_admin_read" ON public.schedule_change_notifications;
  IF to_regprocedure('public.is_schedule_superadmin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "schedule_change_admin_read" ON public.schedule_change_notifications
        FOR SELECT TO authenticated
        USING (
          public.is_schedule_superadmin()
          OR (
            public.is_schedule_regional_manager()
            AND (
              (institution_id IS NOT NULL AND public.manages_institution(institution_id))
              OR (
                institution_id IS NULL
                AND public.teacher_at_managed_institution(teacher_id)
              )
            )
          )
        )
    $policy$;
  ELSIF to_regprocedure('public.is_schedule_admin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "schedule_change_admin_read" ON public.schedule_change_notifications
        FOR SELECT TO authenticated
        USING (public.is_schedule_admin())
    $policy$;
  END IF;

  DROP POLICY IF EXISTS "schedule_change_admin_update" ON public.schedule_change_notifications;
  IF to_regprocedure('public.is_schedule_superadmin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "schedule_change_admin_update" ON public.schedule_change_notifications
        FOR UPDATE TO authenticated
        USING (
          public.is_schedule_superadmin()
          OR (
            public.is_schedule_regional_manager()
            AND (
              (institution_id IS NOT NULL AND public.manages_institution(institution_id))
              OR (
                institution_id IS NULL
                AND public.teacher_at_managed_institution(teacher_id)
              )
            )
          )
        )
        WITH CHECK (
          public.is_schedule_superadmin()
          OR (
            public.is_schedule_regional_manager()
            AND (
              (institution_id IS NOT NULL AND public.manages_institution(institution_id))
              OR (
                institution_id IS NULL
                AND public.teacher_at_managed_institution(teacher_id)
              )
            )
          )
        )
    $policy$;
  ELSIF to_regprocedure('public.is_schedule_admin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "schedule_change_admin_update" ON public.schedule_change_notifications
        FOR UPDATE TO authenticated
        USING (public.is_schedule_admin())
        WITH CHECK (public.is_schedule_admin())
    $policy$;
  END IF;
END $$;
