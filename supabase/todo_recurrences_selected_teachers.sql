-- 담당자 확장: selected_teachers + shared + spawn_group_id
-- 멱등 실행 가능
--
-- audience_type:
--   assignee            = 지정 1명 (assignee_id)
--   selected_teachers   = teacher_ids 배열의 선생님만 (각자 인스턴스)
--   all_teachers        = 활성 role=teacher 전원 (각자 인스턴스)
--   shared              = 담당: 전체 공용 1건 (assignee_id NULL)
--
-- admin_todos.spawn_group_id:
--   일회성 "여러 명/전체 선생님" 등록 시 같은 배치를 묶는 UUID

-- ============================================
-- 1) todo_recurrences.teacher_ids
-- ============================================
ALTER TABLE public.todo_recurrences
  ADD COLUMN IF NOT EXISTS teacher_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.todo_recurrences.teacher_ids IS
  'audience_type=selected_teachers 일 때 대상 선생님 id 목록';

CREATE INDEX IF NOT EXISTS idx_todo_recurrences_teacher_ids
  ON public.todo_recurrences USING GIN (teacher_ids);

-- ============================================
-- 2) audience_type 확장 + CHECK 재정의
-- ============================================
ALTER TABLE public.todo_recurrences
  DROP CONSTRAINT IF EXISTS todo_recurrences_audience_type_check;

ALTER TABLE public.todo_recurrences
  ADD CONSTRAINT todo_recurrences_audience_type_check
  CHECK (audience_type IN ('assignee', 'all_teachers', 'selected_teachers', 'shared'));

ALTER TABLE public.todo_recurrences
  DROP CONSTRAINT IF EXISTS todo_recurrences_assignee_required_chk;

ALTER TABLE public.todo_recurrences
  ADD CONSTRAINT todo_recurrences_audience_fields_chk CHECK (
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
  );

COMMENT ON COLUMN public.todo_recurrences.audience_type IS
  'assignee=지정 1명, selected_teachers=선택 선생님, all_teachers=활성 teacher 전원, shared=공용 1건(assignee_id null)';

-- ============================================
-- 3) admin_todos.spawn_group_id (일회성 그룹)
-- ============================================
ALTER TABLE public.admin_todos
  ADD COLUMN IF NOT EXISTS spawn_group_id uuid;

COMMENT ON COLUMN public.admin_todos.spawn_group_id IS
  '일회성 멀티/전체 선생님 등록 배치 ID. 같으면 관리자 화면에서 그룹 요약.';

CREATE INDEX IF NOT EXISTS idx_admin_todos_spawn_group
  ON public.admin_todos (spawn_group_id)
  WHERE spawn_group_id IS NOT NULL;

-- 공용(shared) 반복 인스턴스 멱등: 월당 assignee_id null 1건
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_todos_recurrence_period_shared
  ON public.admin_todos (recurrence_id, period_ym)
  WHERE recurrence_id IS NOT NULL AND period_ym IS NOT NULL AND assignee_id IS NULL;
