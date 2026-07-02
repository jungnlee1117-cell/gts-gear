-- resources 테이블 정책·파일형식 확장
-- Supabase SQL Editor에서 실행

ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_file_type_check;
ALTER TABLE public.resources ADD CONSTRAINT resources_file_type_check
  CHECK (file_type IS NULL OR file_type IN (
    'pdf', 'video', 'image', 'word', 'excel', 'hwp', 'audio', 'youtube', 'other'
  ));

DROP POLICY IF EXISTS "resources_update_admin" ON public.resources;
CREATE POLICY "resources_update" ON public.resources
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "resources_delete_superadmin" ON public.resources;
CREATE POLICY "resources_delete" ON public.resources
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

-- Storage 삭제: Dashboard > Storage > pe-resources > Policies
-- authenticated 사용자가 본인 업로드 또는 admin/superadmin이 삭제할 수 있도록 DELETE 정책 추가 권장
