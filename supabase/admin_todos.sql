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
  start_date date,
  due_date date,           -- 기간 종료일 (D-day 기준)
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low')),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,  -- 하위 체크리스트 [{id,text,done}]
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 기존 테이블 대응: 기간 시작일 / 하위 체크리스트 / 우선순위 컬럼 추가
ALTER TABLE public.admin_todos ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.admin_todos ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.admin_todos ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
DO $$ BEGIN
  ALTER TABLE public.admin_todos ADD CONSTRAINT admin_todos_priority_chk CHECK (priority IN ('urgent', 'normal', 'low'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

-- ============================================
-- 3) PostgREST 스키마 캐시 갱신
--    (새 컬럼이 API 스키마 캐시에 즉시 반영되도록)
-- ============================================
NOTIFY pgrst, 'reload schema';
