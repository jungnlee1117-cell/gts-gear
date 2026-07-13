-- 관리자 "할 일" 목록 테이블
-- 메인(공지) 화면의 할 일 섹션에서 사용 — 슈퍼관리자/관리자 전용
-- 멱등 (이미 있으면 스킵 / 정책만 재적용)

-- ============================================
-- 1) 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  assignee_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_todos_open
  ON public.admin_todos (is_completed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_todos_assignee
  ON public.admin_todos (assignee_id);

COMMENT ON TABLE public.admin_todos IS '관리자 할 일 — 메인 공지 화면 할 일 섹션';

-- ============================================
-- 2) RLS — 관리자(admin/superadmin)만 전체 관리
-- ============================================
ALTER TABLE public.admin_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_todos_admin_all" ON public.admin_todos;
CREATE POLICY "admin_todos_admin_all" ON public.admin_todos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid()
        AND (t.role IN ('admin', 'superadmin') OR t.is_item_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid()
        AND (t.role IN ('admin', 'superadmin') OR t.is_item_admin = true)
    )
  );
