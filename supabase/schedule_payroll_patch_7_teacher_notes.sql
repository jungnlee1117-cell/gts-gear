-- 강사 개인 메모 (날짜별 자유 텍스트)
-- schedule_payroll_patch_6_exception_end_date.sql 실행 후 적용

CREATE TABLE IF NOT EXISTS public.teacher_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_notes_teacher_date
  ON public.teacher_notes (teacher_id, note_date DESC);

COMMENT ON TABLE public.teacher_notes IS '강사 개인 일별 메모 — 본인만 작성, 관리자 읽기';

ALTER TABLE public.teacher_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_notes_admin_read" ON public.teacher_notes;
CREATE POLICY "teacher_notes_admin_read" ON public.teacher_notes
  FOR SELECT TO authenticated
  USING (public.is_schedule_admin());

DROP POLICY IF EXISTS "teacher_notes_own_select" ON public.teacher_notes;
CREATE POLICY "teacher_notes_own_select" ON public.teacher_notes
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_notes_own_insert" ON public.teacher_notes;
CREATE POLICY "teacher_notes_own_insert" ON public.teacher_notes
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_notes_own_update" ON public.teacher_notes;
CREATE POLICY "teacher_notes_own_update" ON public.teacher_notes
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_notes_own_delete" ON public.teacher_notes;
CREATE POLICY "teacher_notes_own_delete" ON public.teacher_notes
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());
