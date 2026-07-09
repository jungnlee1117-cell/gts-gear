-- 교구 카테고리 마스터
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.gear_categories (
  id text PRIMARY KEY,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  icon text NOT NULL DEFAULT '⭐',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS gear_categories_sort_order_idx
  ON public.gear_categories (sort_order);

ALTER TABLE public.gear_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gear_categories_select" ON public.gear_categories;
CREATE POLICY "gear_categories_select" ON public.gear_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gear_categories_insert_admin" ON public.gear_categories;
CREATE POLICY "gear_categories_insert_admin" ON public.gear_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_item_admin());

DROP POLICY IF EXISTS "gear_categories_update_admin" ON public.gear_categories;
CREATE POLICY "gear_categories_update_admin" ON public.gear_categories
  FOR UPDATE TO authenticated
  USING (public.is_item_admin());

DROP POLICY IF EXISTS "gear_categories_delete_admin" ON public.gear_categories;
CREATE POLICY "gear_categories_delete_admin" ON public.gear_categories
  FOR DELETE TO authenticated
  USING (public.is_item_admin());

-- 기본 카테고리 (비어 있을 때만 삽입, 이벤트는 맨 마지막)
INSERT INTO public.gear_categories (id, label, color, icon, sort_order)
SELECT * FROM (VALUES
  ('AIR',    '에어교구',   '#0891b2', '🎈',  1),
  ('BALL',   '공류',       '#ea580c', '⚽',  2),
  ('BAL',    '밸런스',     '#059669', '⚖️',  3),
  ('SPORT',  '스포츠',     '#2563eb', '🏅',  4),
  ('TOOL',   '도구류',     '#7c3aed', '🧰',  5),
  ('DIG',    '디지털',     '#db2777', '💡',  6),
  ('MAT',    '매트/기구',  '#65a30d', '🟩',  7),
  ('GROUP',  '단체놀이',   '#d97706', '👥',  8),
  ('STACK',  '쌓기',       '#8b5cf6', '🏗️',  9),
  ('TARGET', '표적교구',   '#0d9488', '🎯', 10),
  ('ETC',    '기타교구',   '#7c3aed', '⭐', 11),
  ('EVENT',  '이벤트',     '#ec4899', '🎉', 12)
) AS v(id, label, color, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.gear_categories LIMIT 1);

-- 기존 DB에 이벤트 카테고리만 없으면 추가
INSERT INTO public.gear_categories (id, label, color, icon, sort_order)
SELECT 'EVENT', '이벤트', '#ec4899', '🎉', COALESCE((SELECT MAX(sort_order) FROM public.gear_categories), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM public.gear_categories WHERE id = 'EVENT');
