-- 공지 RLS: admin/superadmin만 작성·수정·삭제 (is_item_admin 강사 제외)
-- notices.sql 또는 notices_patch_item_admin_policies.sql 적용 후 실행

DO $$
BEGIN
  IF to_regclass('public.notices') IS NULL THEN
    RAISE EXCEPTION 'public.notices 테이블이 없습니다. 먼저 supabase/notices.sql 을 실행하세요.';
  END IF;

  DROP POLICY IF EXISTS "notices_insert_admin" ON public.notices;
  CREATE POLICY "notices_insert_admin" ON public.notices
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
      )
    );

  DROP POLICY IF EXISTS "notices_update_admin" ON public.notices;
  CREATE POLICY "notices_update_admin" ON public.notices
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
      )
    );

  DROP POLICY IF EXISTS "notices_delete_superadmin" ON public.notices;
  DROP POLICY IF EXISTS "notices_delete_admin" ON public.notices;
  CREATE POLICY "notices_delete_admin" ON public.notices
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
      )
    );
END $$;
