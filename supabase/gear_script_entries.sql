-- 교구 대본 카탈로그 (정적 GEAR_CATALOG + DB 등록 항목 merge)
-- Supabase SQL Editor에서 실행하세요.

-- ── 헬퍼: admin / superadmin ──
CREATE OR REPLACE FUNCTION public.is_gear_script_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
  );
$$;

-- ── 테이블 ──
CREATE TABLE IF NOT EXISTS public.gear_script_entries (
  id text PRIMARY KEY,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  script_type text NOT NULL DEFAULT 'activities'
    CHECK (script_type IN ('activities', 'sections')),
  match_patterns text[] NOT NULL DEFAULT '{}',
  level_ids text[] NOT NULL DEFAULT ARRAY['foundation', 'interactive'],
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gear_script_entries_item_id
  ON public.gear_script_entries(item_id);

CREATE INDEX IF NOT EXISTS idx_gear_script_entries_updated_at
  ON public.gear_script_entries(updated_at DESC);

COMMENT ON TABLE public.gear_script_entries IS 'DB 등록 교구 대본 (정적 GEAR_CATALOG와 런타임 merge)';
COMMENT ON COLUMN public.gear_script_entries.id IS '카탈로그 id (slug)';
COMMENT ON COLUMN public.gear_script_entries.item_id IS '재고 items.id (등록 출처, 선택)';
COMMENT ON COLUMN public.gear_script_entries.match_patterns IS 'matchGearId용 이름/별칭 패턴';
COMMENT ON COLUMN public.gear_script_entries.content_json IS 'intro / activities / closing / safety 등 대본 JSON';
COMMENT ON COLUMN public.gear_script_entries.script_type IS '1차: activities만 사용';

-- ── RLS ──
ALTER TABLE public.gear_script_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gear_script_entries_select" ON public.gear_script_entries;
CREATE POLICY "gear_script_entries_select" ON public.gear_script_entries
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "gear_script_entries_insert" ON public.gear_script_entries;
CREATE POLICY "gear_script_entries_insert" ON public.gear_script_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gear_script_admin());

DROP POLICY IF EXISTS "gear_script_entries_update" ON public.gear_script_entries;
CREATE POLICY "gear_script_entries_update" ON public.gear_script_entries
  FOR UPDATE TO authenticated
  USING (public.is_gear_script_admin())
  WITH CHECK (public.is_gear_script_admin());

DROP POLICY IF EXISTS "gear_script_entries_delete" ON public.gear_script_entries;
CREATE POLICY "gear_script_entries_delete" ON public.gear_script_entries
  FOR DELETE TO authenticated
  USING (public.is_gear_script_admin());
