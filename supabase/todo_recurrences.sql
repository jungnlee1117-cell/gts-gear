-- 반복 할 일(todo_recurrences) + admin_todos 인스턴스 확장
-- 멱등 실행 가능
--
-- 정책 요약:
--   · 템플릿 수정 → 다음 달 spawn부터 반영 (이번 달 인스턴스 소급 없음)
--   · 템플릿 삭제/비활성 → 이번 달 인스턴스 유지, 다음 달부터 미생성
--   · 개인별 완료 = 선생님(또는 담당자)마다 admin_todos 행 1개

-- ============================================
-- 1) 템플릿 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.todo_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  recurrence text NOT NULL DEFAULT 'monthly'
    CHECK (recurrence IN ('monthly')),
  start_day int NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
  end_day int NOT NULL CHECK (end_day >= 1 AND end_day <= 31),
  audience_type text NOT NULL
    CHECK (audience_type IN ('assignee', 'all_teachers', 'selected_teachers', 'shared')),
  assignee_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  teacher_ids uuid[] NOT NULL DEFAULT '{}',
  priority text NOT NULL DEFAULT 'important'
    CHECK (priority IN ('urgent', 'important', 'normal', 'low')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT todo_recurrences_day_order_chk CHECK (start_day <= end_day),
  CONSTRAINT todo_recurrences_audience_fields_chk CHECK (
    (
      audience_type = 'assignee'
      AND assignee_id IS NOT NULL
      AND coalesce(cardinality(teacher_ids), 0) = 0
    )
    OR (
      audience_type = 'all_teachers'
      AND assignee_id IS NULL
      AND coalesce(cardinality(teacher_ids), 0) = 0
    )
    OR (
      audience_type = 'selected_teachers'
      AND assignee_id IS NULL
      AND cardinality(teacher_ids) >= 1
    )
    OR (
      audience_type = 'shared'
      AND assignee_id IS NULL
      AND coalesce(cardinality(teacher_ids), 0) = 0
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_todo_recurrences_active
  ON public.todo_recurrences (active, created_at DESC);

COMMENT ON TABLE public.todo_recurrences IS
  '매달 반복 할 일 템플릿. 인스턴스는 admin_todos로 매월 생성.';
COMMENT ON COLUMN public.todo_recurrences.start_day IS
  '매월 알림/기간 시작일(1-31). 말일보다 크면 그달 말일로 클램프.';
COMMENT ON COLUMN public.todo_recurrences.end_day IS
  '매월 알림/기간 종료일(1-31). 말일보다 크면 그달 말일로 클램프.';
COMMENT ON COLUMN public.todo_recurrences.audience_type IS
  'assignee=지정 1명, selected_teachers=선택 선생님, all_teachers=활성 teacher 전원, shared=공용 1건.';
COMMENT ON COLUMN public.todo_recurrences.teacher_ids IS
  'audience_type=selected_teachers 일 때 대상 선생님 id 목록';
COMMENT ON COLUMN public.todo_recurrences.active IS
  'false면 다음 달부터 spawn 안 함. 이미 만든 인스턴스는 유지.';

CREATE INDEX IF NOT EXISTS idx_todo_recurrences_teacher_ids
  ON public.todo_recurrences USING GIN (teacher_ids);

-- ============================================
-- 2) admin_todos 인스턴스 컬럼
-- ============================================
ALTER TABLE public.admin_todos
  ADD COLUMN IF NOT EXISTS recurrence_id uuid
    REFERENCES public.todo_recurrences(id) ON DELETE SET NULL;

ALTER TABLE public.admin_todos
  ADD COLUMN IF NOT EXISTS period_ym text;

ALTER TABLE public.admin_todos
  ADD COLUMN IF NOT EXISTS spawn_group_id uuid;

COMMENT ON COLUMN public.admin_todos.recurrence_id IS
  '반복 템플릿 FK. null이면 일회성 할 일.';
COMMENT ON COLUMN public.admin_todos.period_ym IS
  '인스턴스 대상 월 YYYY-MM (예: 2026-07).';
COMMENT ON COLUMN public.admin_todos.spawn_group_id IS
  '일회성 멀티/전체 선생님 등록 배치 ID.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_todos_recurrence_period_assignee
  ON public.admin_todos (recurrence_id, period_ym, assignee_id)
  WHERE recurrence_id IS NOT NULL AND period_ym IS NOT NULL AND assignee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_todos_recurrence_period_shared
  ON public.admin_todos (recurrence_id, period_ym)
  WHERE recurrence_id IS NOT NULL AND period_ym IS NOT NULL AND assignee_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_todos_spawn_group
  ON public.admin_todos (spawn_group_id)
  WHERE spawn_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_todos_recurrence_window
  ON public.admin_todos (recurrence_id, is_completed, start_date, due_date)
  WHERE recurrence_id IS NOT NULL;

-- ============================================
-- 3) RLS — 템플릿: 슈퍼관리자만
-- ============================================
ALTER TABLE public.todo_recurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todo_recurrences_superadmin_all" ON public.todo_recurrences;
CREATE POLICY "todo_recurrences_superadmin_all" ON public.todo_recurrences
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role = 'superadmin'
    )
  );

-- ============================================
-- 4) RLS — admin_todos: 담당자 본인 조회/완료 업데이트
-- ============================================
DROP POLICY IF EXISTS "admin_todos_assignee_select" ON public.admin_todos;
CREATE POLICY "admin_todos_assignee_select" ON public.admin_todos
  FOR SELECT TO authenticated
  USING (assignee_id = auth.uid());

DROP POLICY IF EXISTS "admin_todos_assignee_update" ON public.admin_todos;
CREATE POLICY "admin_todos_assignee_update" ON public.admin_todos
  FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid())
  WITH CHECK (assignee_id = auth.uid());

NOTIFY pgrst, 'reload schema';
