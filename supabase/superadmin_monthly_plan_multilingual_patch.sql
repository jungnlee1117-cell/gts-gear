-- 기존 슈퍼관리자 월간 계획안에 연령별 영어 계획안과 교구 사진을 추가합니다.
-- 기존 한국어 계획안 데이터는 삭제하지 않습니다.

ALTER TABLE public.monthly_plan_drafts
  ADD COLUMN IF NOT EXISTS english_goal text NOT NULL DEFAULT '';

ALTER TABLE public.monthly_plan_draft_entries
  ADD COLUMN IF NOT EXISTS key_expression text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.monthly_plan_draft_entries
  DROP CONSTRAINT IF EXISTS monthly_plan_draft_entries_age_group_check;

ALTER TABLE public.monthly_plan_draft_entries
  ADD CONSTRAINT monthly_plan_draft_entries_age_group_check
  CHECK (age_group IN ('3_4', '5', '7', 'en', 'en_5', 'en_6', 'en_7'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'monthly-plan-images',
  'monthly-plan-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "monthly_plan_images_superadmin_select" ON storage.objects;
CREATE POLICY "monthly_plan_images_superadmin_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_monthly_plan_superadmin()
  );

DROP POLICY IF EXISTS "monthly_plan_images_superadmin_insert" ON storage.objects;
CREATE POLICY "monthly_plan_images_superadmin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_monthly_plan_superadmin()
  );

DROP POLICY IF EXISTS "monthly_plan_images_superadmin_update" ON storage.objects;
CREATE POLICY "monthly_plan_images_superadmin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_monthly_plan_superadmin()
  )
  WITH CHECK (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_monthly_plan_superadmin()
  );

DROP POLICY IF EXISTS "monthly_plan_images_superadmin_delete" ON storage.objects;
CREATE POLICY "monthly_plan_images_superadmin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'monthly-plan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_monthly_plan_superadmin()
  );
