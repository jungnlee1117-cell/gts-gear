-- 체육자료실: 유튜브 링크 자료 타입 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_file_type_check;
ALTER TABLE public.resources ADD CONSTRAINT resources_file_type_check
  CHECK (file_type IS NULL OR file_type IN (
    'pdf', 'video', 'image', 'word', 'excel', 'hwp', 'audio', 'youtube', 'other'
  ));
