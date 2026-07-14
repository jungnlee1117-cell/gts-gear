-- payroll_entries: 대체 수업 / 보강 수업 컬럼
-- schedule_payroll_patch_30 이후 실행

ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS substitute_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_makeup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS makeup_date date,
  ADD COLUMN IF NOT EXISTS makeup_start_time time,
  ADD COLUMN IF NOT EXISTS makeup_end_time time;

CREATE INDEX IF NOT EXISTS idx_payroll_entries_substitute_teacher
  ON public.payroll_entries (substitute_teacher_id, class_date)
  WHERE substitute_teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_entries_makeup_date
  ON public.payroll_entries (makeup_date)
  WHERE is_makeup = true AND makeup_date IS NOT NULL;

COMMENT ON COLUMN public.payroll_entries.substitute_teacher_id IS
  '대체 수업 담당 선생님. 설정 시 수업료는 이 선생님에게 귀속되고 원래 선생님은 제외';
COMMENT ON COLUMN public.payroll_entries.is_makeup IS
  '보강 수업 여부';
COMMENT ON COLUMN public.payroll_entries.makeup_date IS
  '보강 수업 실시 날짜';
COMMENT ON COLUMN public.payroll_entries.makeup_start_time IS
  '보강 시작 시간';
COMMENT ON COLUMN public.payroll_entries.makeup_end_time IS
  '보강 종료 시간';

-- 대체 선생님도 본인에게 배정된 대체 수업을 조회할 수 있도록 SELECT 정책 갱신
DROP POLICY IF EXISTS "payroll_teacher_own" ON public.payroll_entries;
CREATE POLICY "payroll_teacher_own" ON public.payroll_entries
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR substitute_teacher_id = auth.uid()
  );
