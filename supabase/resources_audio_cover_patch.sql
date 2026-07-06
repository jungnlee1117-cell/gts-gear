-- 음원 자료실: 앨범 아트 URL
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN public.resources.cover_url IS '음원 앨범 아트 이미지 URL (선택)';
