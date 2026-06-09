-- 교구 활동 사진 (다중 업로드 URL 배열)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS activity_photos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN items.activity_photos IS '활동 사진 public URL 배열 (item-photos 버킷)';
