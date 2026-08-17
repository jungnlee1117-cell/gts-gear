-- 세트형 교구: item_sets, item_set_components, rental_items 확장
-- schedule_payroll_patch_17 (is_item_admin) 적용 후 실행

-- ============================================
-- item_sets — 세트 교구 마스터
-- ============================================
CREATE TABLE IF NOT EXISTS public.item_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  alias text,
  category text NOT NULL DEFAULT '',
  branch text,
  description text,
  usage_description text,
  safety_notes text,
  youtube_url text,
  photo_url text,
  photo_position text NOT NULL DEFAULT 'center center',
  activity_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'maintenance', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS item_sets_code_unique
  ON public.item_sets (lower(trim(code)));

CREATE UNIQUE INDEX IF NOT EXISTS item_sets_name_normalized_unique
  ON public.item_sets (lower(trim(name)));

COMMENT ON TABLE public.item_sets IS '세트형 교구 (예: 바다낚시 세트, 민물낚시 세트)';
COMMENT ON COLUMN public.item_sets.status IS 'available | maintenance | retired';

-- ============================================
-- item_set_components — 세트 하위 품목 (품목별 재고)
-- ============================================
CREATE TABLE IF NOT EXISTS public.item_set_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.item_sets(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_quantity integer NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_set_components_set_name_unique UNIQUE (set_id, name)
);

CREATE INDEX IF NOT EXISTS item_set_components_set_id_idx
  ON public.item_set_components (set_id, sort_order);

COMMENT ON TABLE public.item_set_components IS '세트에 속한 하위 품목 (꽃게, 낚시대 등) — 품목별 재고 관리';
COMMENT ON COLUMN public.item_set_components.total_quantity IS '해당 품목 총 보유 수량';

-- ============================================
-- rental_items — 세트 대여 기록 컬럼
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.rental_items') IS NULL THEN
    RAISE NOTICE 'public.rental_items 없음 — rental_items 확장 스킵';
    RETURN;
  END IF;

  ALTER TABLE public.rental_items
    ADD COLUMN IF NOT EXISTS set_id uuid REFERENCES public.item_sets(id) ON DELETE RESTRICT;

  ALTER TABLE public.rental_items
    ADD COLUMN IF NOT EXISTS component_name text;

  -- 세트 품목 대여 시 item_id 없이 기록 가능
  ALTER TABLE public.rental_items
    ALTER COLUMN item_id DROP NOT NULL;

  -- item_id 또는 (set_id + component_name) 중 하나는 필수
  ALTER TABLE public.rental_items
    DROP CONSTRAINT IF EXISTS rental_items_item_or_set_check;

  ALTER TABLE public.rental_items
    ADD CONSTRAINT rental_items_item_or_set_check CHECK (
      (item_id IS NOT NULL AND set_id IS NULL AND component_name IS NULL)
      OR (item_id IS NULL AND set_id IS NOT NULL AND component_name IS NOT NULL AND length(trim(component_name)) > 0)
    );
END $$;

CREATE INDEX IF NOT EXISTS rental_items_set_component_idx
  ON public.rental_items (set_id, component_name)
  WHERE set_id IS NOT NULL;

COMMENT ON COLUMN public.rental_items.set_id IS '세트형 교구 ID (일반 교구 대여 시 NULL)';
COMMENT ON COLUMN public.rental_items.component_name IS '세트 하위 품목명 (예: 꽃게, 낚시대)';

-- ============================================
-- updated_at 트리거
-- ============================================
CREATE OR REPLACE FUNCTION public.touch_item_sets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS item_sets_updated_at ON public.item_sets;
CREATE TRIGGER item_sets_updated_at
  BEFORE UPDATE ON public.item_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_item_sets_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.item_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_set_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_sets_select" ON public.item_sets;
CREATE POLICY "item_sets_select" ON public.item_sets
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "item_sets_insert_admin" ON public.item_sets;
CREATE POLICY "item_sets_insert_admin" ON public.item_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_item_admin());

DROP POLICY IF EXISTS "item_sets_update_admin" ON public.item_sets;
CREATE POLICY "item_sets_update_admin" ON public.item_sets
  FOR UPDATE TO authenticated
  USING (public.is_item_admin())
  WITH CHECK (public.is_item_admin());

DROP POLICY IF EXISTS "item_sets_delete_admin" ON public.item_sets;
CREATE POLICY "item_sets_delete_admin" ON public.item_sets
  FOR DELETE TO authenticated
  USING (public.is_item_admin());

DROP POLICY IF EXISTS "item_set_components_select" ON public.item_set_components;
CREATE POLICY "item_set_components_select" ON public.item_set_components
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "item_set_components_insert_admin" ON public.item_set_components;
CREATE POLICY "item_set_components_insert_admin" ON public.item_set_components
  FOR INSERT TO authenticated
  WITH CHECK (public.is_item_admin());

DROP POLICY IF EXISTS "item_set_components_update_admin" ON public.item_set_components;
CREATE POLICY "item_set_components_update_admin" ON public.item_set_components
  FOR UPDATE TO authenticated
  USING (public.is_item_admin())
  WITH CHECK (public.is_item_admin());

DROP POLICY IF EXISTS "item_set_components_delete_admin" ON public.item_set_components;
CREATE POLICY "item_set_components_delete_admin" ON public.item_set_components
  FOR DELETE TO authenticated
  USING (public.is_item_admin());

-- Realtime (선택)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.item_sets;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.item_set_components;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
