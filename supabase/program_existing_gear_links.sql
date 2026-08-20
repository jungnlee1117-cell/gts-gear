-- 프로그램의 필요 교구를 실제 등록 교구(items)와 연결합니다.
-- 기존 프로그램/대여 기록은 삭제하지 않고 그대로 유지합니다.

ALTER TABLE public.item_set_components
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS item_set_components_set_item_unique
  ON public.item_set_components (set_id, item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS item_set_components_item_id_idx
  ON public.item_set_components (item_id)
  WHERE item_id IS NOT NULL;

COMMENT ON COLUMN public.item_set_components.item_id
  IS '프로그램에 연결된 실제 등록 교구 ID. NULL은 기존 자유입력 레거시 품목';
DO $$
BEGIN
  IF to_regclass('public.rental_items') IS NULL THEN
    RAISE NOTICE 'public.rental_items 없음 — 제약조건 변경 스킵';
    RETURN;
  END IF;

  ALTER TABLE public.rental_items
    DROP CONSTRAINT IF EXISTS rental_items_item_or_set_check;

  ALTER TABLE public.rental_items
    ADD CONSTRAINT rental_items_item_or_set_check CHECK (
      -- 일반 교구 대여
      (item_id IS NOT NULL AND set_id IS NULL AND component_name IS NULL)
      -- 실제 교구와 연결된 프로그램 대여
      OR (item_id IS NOT NULL AND set_id IS NOT NULL AND component_name IS NOT NULL AND length(trim(component_name)) > 0)
      -- 이전 프로그램 대여 기록 호환
      OR (item_id IS NULL AND set_id IS NOT NULL AND component_name IS NOT NULL AND length(trim(component_name)) > 0)
    );
END $$;

CREATE INDEX IF NOT EXISTS rental_items_program_item_idx
  ON public.rental_items (set_id, item_id)
  WHERE set_id IS NOT NULL AND item_id IS NOT NULL;
