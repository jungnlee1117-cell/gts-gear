-- 체육자료실 resources 테이블 + Storage 버킷
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL,
  subcategory text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  file_url text,
  file_name text,
  file_type text CHECK (file_type IS NULL OR file_type IN ('pdf', 'video', 'image', 'other')),
  file_size bigint,
  author_id uuid REFERENCES auth.users(id),
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS resources_category_id_idx ON public.resources(category_id);
CREATE INDEX IF NOT EXISTS resources_created_at_idx ON public.resources(created_at DESC);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resources_select" ON public.resources;
CREATE POLICY "resources_select" ON public.resources
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "resources_insert_admin" ON public.resources;
CREATE POLICY "resources_insert_admin" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "resources_update_admin" ON public.resources;
CREATE POLICY "resources_update_admin" ON public.resources
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "resources_delete_superadmin" ON public.resources;
CREATE POLICY "resources_delete_superadmin" ON public.resources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role = 'superadmin'
    )
  );

-- Storage 버킷 (Dashboard에서 pe-resources 버킷 생성 후 아래 정책 실행)
-- Public read 권장 (또는 signed URL 사용)

-- INSERT INTO storage.buckets (id, name, public) VALUES ('pe-resources', 'pe-resources', true)
-- ON CONFLICT (id) DO NOTHING;
