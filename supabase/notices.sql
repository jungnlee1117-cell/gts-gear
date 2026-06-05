-- 공지사항 테이블 (중요도 컬럼 포함)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  importance text NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal', 'important')),
  author_id uuid REFERENCES auth.users(id),
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS importance text NOT NULL DEFAULT 'normal';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 기존 CHECK 제약이 없을 때만 (이미 있으면 무시)
DO $$
BEGIN
  ALTER TABLE public.notices
    ADD CONSTRAINT notices_importance_check CHECK (importance IN ('normal', 'important'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notices_select" ON public.notices;
CREATE POLICY "notices_select" ON public.notices
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notices_insert_admin" ON public.notices;
CREATE POLICY "notices_insert_admin" ON public.notices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "notices_update_admin" ON public.notices;
CREATE POLICY "notices_update_admin" ON public.notices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "notices_delete_superadmin" ON public.notices;
CREATE POLICY "notices_delete_superadmin" ON public.notices
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role = 'superadmin'
    )
  );
