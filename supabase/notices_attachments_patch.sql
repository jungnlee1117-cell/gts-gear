-- 공지사항 이미지·문서 첨부 기능
-- Storage 경로 첫 폴더는 notice_id이며, 공지 수신 권한과 파일 열람 권한을 동일하게 적용합니다.

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS body_style jsonb NOT NULL DEFAULT '{"font":"sans","size":"medium"}'::jsonb;

ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_attachments_array_check;
ALTER TABLE public.notices
  ADD CONSTRAINT notices_attachments_array_check
  CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 10);

ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_body_style_object_check;
ALTER TABLE public.notices
  ADD CONSTRAINT notices_body_style_object_check
  CHECK (jsonb_typeof(body_style) = 'object');

COMMENT ON COLUMN public.notices.attachments IS
  '비공개 notice-attachments 파일 metadata 배열(id,path,name,mime_type,size)';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notice-attachments', 'notice-attachments', false, 15728640,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf', 'application/octet-stream',
    'application/haansofthwp', 'application/vnd.hancom.hwp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'application/zip', 'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- SELECT는 해당 notice_id 공지를 실제로 조회할 수 있을 때만 허용합니다.
-- public.notices의 기존 수신 대상 RLS가 기관/지정 선생님 범위를 판정합니다.
DROP POLICY IF EXISTS "notice_attachments_recipient_select" ON storage.objects;
CREATE POLICY "notice_attachments_recipient_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'notice-attachments'
    AND EXISTS (
      SELECT 1 FROM public.notices n
      WHERE n.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "notice_attachments_admin_insert" ON storage.objects;
CREATE POLICY "notice_attachments_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notice-attachments'
    AND EXISTS (
      SELECT 1 FROM public.notices n
      WHERE n.id::text = (storage.foldername(name))[1]
    )
    AND EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.active IS NOT FALSE
        AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "notice_attachments_admin_update" ON storage.objects;
CREATE POLICY "notice_attachments_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'notice-attachments'
    AND EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.active IS NOT FALSE
        AND t.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    bucket_id = 'notice-attachments'
    AND EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.active IS NOT FALSE
        AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "notice_attachments_admin_delete" ON storage.objects;
CREATE POLICY "notice_attachments_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'notice-attachments'
    AND EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.active IS NOT FALSE
        AND t.role IN ('admin', 'superadmin')
    )
  );
