-- 대여 연장 기능: rental_items 연장 횟수/일시 컬럼 추가
-- 반납 임박·연체 교구를 새 대여 신청 시 연장할 때 사용
-- 멱등 (이미 있으면 스킵)

ALTER TABLE public.rental_items
  ADD COLUMN IF NOT EXISTS extension_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.rental_items
  ADD COLUMN IF NOT EXISTS last_extended_at timestamptz;

COMMENT ON COLUMN public.rental_items.extension_count IS '대여 연장 횟수 (최대 제한은 앱에서 관리)';
COMMENT ON COLUMN public.rental_items.last_extended_at IS '마지막 연장 처리 시각';
