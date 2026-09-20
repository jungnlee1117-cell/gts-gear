-- 선생님 개인 할 일 권한
-- · 본인에게 배정된 행만 조회
-- · 본인이 직접 만든 일회성 할 일만 생성/내용 수정/삭제
-- · 관리자가 배정한 할 일은 완료 상태만 변경 가능

ALTER TABLE public.admin_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_todos_assignee_select" ON public.admin_todos;
CREATE POLICY "admin_todos_assignee_select" ON public.admin_todos
  FOR SELECT TO authenticated
  USING (assignee_id = auth.uid());

DROP POLICY IF EXISTS "admin_todos_assignee_insert" ON public.admin_todos;
CREATE POLICY "admin_todos_assignee_insert" ON public.admin_todos
  FOR INSERT TO authenticated
  WITH CHECK (
    assignee_id = auth.uid()
    AND created_by = auth.uid()
    AND recurrence_id IS NULL
    AND period_ym IS NULL
    AND spawn_group_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = auth.uid()
        AND t.role = 'teacher'
        AND t.active = true
        AND t.resigned_at IS NULL
    )
  );

DROP POLICY IF EXISTS "admin_todos_assignee_update" ON public.admin_todos;
CREATE POLICY "admin_todos_assignee_update" ON public.admin_todos
  FOR UPDATE TO authenticated
  USING (
    assignee_id = auth.uid()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    assignee_id = auth.uid()
    AND created_by = auth.uid()
    AND recurrence_id IS NULL
    AND period_ym IS NULL
    AND spawn_group_id IS NULL
  );

DROP POLICY IF EXISTS "admin_todos_assignee_delete" ON public.admin_todos;
CREATE POLICY "admin_todos_assignee_delete" ON public.admin_todos
  FOR DELETE TO authenticated
  USING (
    assignee_id = auth.uid()
    AND created_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.set_my_todo_completion(
  p_todo_id uuid,
  p_is_completed boolean
)
RETURNS public.admin_todos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo public.admin_todos;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  UPDATE public.admin_todos
  SET
    is_completed = coalesce(p_is_completed, false),
    completed_at = CASE
      WHEN coalesce(p_is_completed, false) THEN now()
      ELSE NULL
    END
  WHERE id = p_todo_id
    AND assignee_id = auth.uid()
  RETURNING * INTO v_todo;

  IF v_todo.id IS NULL THEN
    RAISE EXCEPTION '본인에게 배정된 할 일을 찾을 수 없습니다.';
  END IF;

  RETURN v_todo;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_todo_completion(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_todo_completion(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
