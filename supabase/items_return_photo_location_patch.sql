-- 반납 위치·최신 사진 (items) + 반납 건별 기록 (return_requests)
-- Supabase SQL Editor에서 실행

-- ── items: 교구당 최신 반납 스냅샷 (덮어쓰기용) ──
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS last_return_photo_url text,
  ADD COLUMN IF NOT EXISTS last_return_location text,
  ADD COLUMN IF NOT EXISTS last_return_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_returned_by uuid REFERENCES public.teachers(id);

COMMENT ON COLUMN public.items.last_return_photo_url IS
  '최신 반납 사진 URL (Storage returns/{item_id}.jpg). NULL이면 사진 없이 반납';
COMMENT ON COLUMN public.items.last_return_location IS
  '최신 반납 위치 (BRANCHES 값)';
COMMENT ON COLUMN public.items.last_return_at IS
  '최신 반납 시각';
COMMENT ON COLUMN public.items.last_returned_by IS
  '최신 반납 처리자 (teachers.id)';

CREATE INDEX IF NOT EXISTS items_last_return_at_idx
  ON public.items (last_return_at DESC NULLS LAST);

-- ── return_requests: 건별 이력 (감사·승인 화면용) ──
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS return_photo_url text,
  ADD COLUMN IF NOT EXISTS return_location text;

COMMENT ON COLUMN public.return_requests.return_photo_url IS
  '해당 반납 건 사진 URL (건너뛰면 NULL)';
COMMENT ON COLUMN public.return_requests.return_location IS
  '해당 반납 건 위치 (BRANCHES, 필수)';
