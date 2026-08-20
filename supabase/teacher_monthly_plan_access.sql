-- 선생님 월간 계획안 작성 권한
-- 각 사용자는 본인이 작성한 계획안과 사진만 조회·등록·수정·삭제할 수 있습니다.

CREATE OR REPLACE FUNCTION public.can_write_own_monthly_plan()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.id = auth.uid()
      AND t.role IN ('teacher', 'superadmin')
      AND COALESCE(t.active, true) = true
      AND t.resigned_at IS NULL
  );
$$;

DROP POLICY IF EXISTS "monthly_plan_drafts_superadmin_only" ON public.monthly_plan_drafts;
DROP POLICY IF EXISTS "monthly_plan_drafts_owner_only" ON public.monthly_plan_drafts;
CREATE POLICY "monthly_plan_drafts_owner_only"
  ON public.monthly_plan_drafts
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    AND public.can_write_own_monthly_plan()
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND public.can_write_own_monthly_plan()
  );

DROP POLICY IF EXISTS "monthly_plan_entries_superadmin_only" ON public.monthly_plan_draft_entries;
DROP POLICY IF EXISTS "monthly_plan_entries_owner_only" ON public.monthly_plan_draft_entries;
CREATE POLICY "monthly_plan_entries_owner_only"
  ON public.monthly_plan_draft_entries
  FOR ALL TO authenticated
  USING (
    public.can_write_own_monthly_plan()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_plan_drafts p
      WHERE p.id = monthly_plan_draft_entries.plan_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.can_write_own_monthly_plan()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_plan_drafts p
      WHERE p.id = monthly_plan_draft_entries.plan_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "monthly_plan_images_superadmin_select" ON storage.objects;
DROP POLICY IF EXISTS "monthly_plan_images_superadmin_insert" ON storage.objects;
DROP POLICY IF EXISTS "monthly_plan_images_superadmin_update" ON storage.objects;
DROP POLICY IF EXISTS "monthly_plan_images_superadmin_delete" ON storage.objects;
DROP POLICY IF EXISTS "monthly_plan_images_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "monthly_plan_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "monthly_plan_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "monthly_plan_images_owner_delete" ON storage.objects;

CREATE POLICY "monthly_plan_images_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_write_own_monthly_plan()
  );

CREATE POLICY "monthly_plan_images_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_write_own_monthly_plan()
  );

CREATE POLICY "monthly_plan_images_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_write_own_monthly_plan()
  )
  WITH CHECK (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_write_own_monthly_plan()
  );

CREATE POLICY "monthly_plan_images_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_write_own_monthly_plan()
  );

GRANT EXECUTE ON FUNCTION public.can_write_own_monthly_plan() TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_plan_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_plan_draft_entries TO authenticated;
