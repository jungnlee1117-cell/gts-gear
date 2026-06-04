-- 교구 사진 표시 위치 (CSS object-position 값)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS photo_position text DEFAULT 'center center';

COMMENT ON COLUMN items.photo_position IS '교구 사진 crop 위치 (예: center top, center center)';
