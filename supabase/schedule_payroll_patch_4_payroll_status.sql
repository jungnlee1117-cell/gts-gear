-- payroll_entries: 수업 안 함(0분) · 스케줄 슬롯 연결 · 입력 상태

ALTER TABLE public.payroll_entries
  DROP CONSTRAINT IF EXISTS payroll_entries_minutes_check;

ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_minutes_check CHECK (minutes >= 0);

ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS entry_status text
    CHECK (entry_status IS NULL OR entry_status IN ('as_scheduled', 'custom', 'skipped'));

ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS schedule_slot_id uuid
    REFERENCES public.institution_weekly_schedule(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_teacher_date_slot
  ON public.payroll_entries (teacher_id, class_date, schedule_slot_id)
  WHERE schedule_slot_id IS NOT NULL;

COMMENT ON COLUMN public.payroll_entries.entry_status IS 'as_scheduled=기본대로, custom=시간수정, skipped=수업안함';
COMMENT ON COLUMN public.payroll_entries.schedule_slot_id IS 'institution_weekly_schedule 슬롯과 1:1 매칭';
