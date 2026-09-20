-- 자료실 월간 계획안 폴더: 본인(또는 관리자)이 Storage 파일을 삭제할 수 있게 합니다.
-- 테이블 RLS는 이미 author_id = auth.uid() 삭제를 허용합니다.

DROP POLICY IF EXISTS "pe_resources_lesson_plans_delete" ON storage.objects;
CREATE POLICY "pe_resources_lesson_plans_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'pe-resources'
    AND (storage.foldername(name))[1] = 'lesson-plans'
    AND (
      (
        (storage.foldername(name))[2] = auth.uid()::text
        AND public.can_manage_lesson_plans()
      )
      OR public.is_lesson_plan_admin()
    )
  );
