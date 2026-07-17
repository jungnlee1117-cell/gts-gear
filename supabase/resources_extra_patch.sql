-- resources.extra: 카테고리별 확장 필드 (행사자료 materials/steps 등)
-- Supabase SQL Editor에서 실행

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.resources.extra IS
  'Category-specific extras. events: { materials: text[], steps: text[] }';
