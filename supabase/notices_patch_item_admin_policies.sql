-- notices 테이블 생성 후 is_item_admin() 기준 RLS로 갱신
-- supabase/notices.sql 실행 뒤 이 파일을 실행하세요.

DO $$
BEGIN
  IF to_regclass('public.notices') IS NULL THEN
    RAISE EXCEPTION 'public.notices 테이블이 없습니다. 먼저 supabase/notices.sql 을 실행하세요.';
  END IF;

  IF to_regprocedure('public.is_item_admin()') IS NULL THEN
    RAISE EXCEPTION 'is_item_admin() 없음. 먼저 schedule_payroll_patch_17_item_admin.sql 을 실행하세요.';
  END IF;

  DROP POLICY IF EXISTS "notices_insert_admin" ON public.notices;
  CREATE POLICY "notices_insert_admin" ON public.notices
    FOR INSERT TO authenticated
    WITH CHECK (public.is_item_admin());

  DROP POLICY IF EXISTS "notices_update_admin" ON public.notices;
  CREATE POLICY "notices_update_admin" ON public.notices
    FOR UPDATE TO authenticated
    USING (public.is_item_admin())
    WITH CHECK (public.is_item_admin());

  DROP POLICY IF EXISTS "notices_delete_superadmin" ON public.notices;
  CREATE POLICY "notices_delete_superadmin" ON public.notices
    FOR DELETE TO authenticated
    USING (public.is_item_admin());
END $$;
