-- payroll_entries: 스케줄 슬롯 연결 + 입력 상태 (급여 일괄/개별 확정 UI)
-- schedule_payroll_patch_4_payroll_status.sql 과 동일 내용 — patch 4 미적용 DB용
-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전)

-- 수업 안 함(0분) 허용
ALTER TABLE public.payroll_entries
  DROP CONSTRAINT IF EXISTS payroll_entries_minutes_check;

ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_minutes_check CHECK (minutes >= 0);

-- 확정 상태: as_scheduled | custom | skipped
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS entry_status text;

ALTER TABLE public.payroll_entries
  DROP CONSTRAINT IF EXISTS payroll_entries_entry_status_check;

ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_entry_status_check
  CHECK (entry_status IS NULL OR entry_status IN ('as_scheduled', 'custom', 'skipped'));

-- 주간 시간표 슬롯과 1:1 매칭 (upsert 키)
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS schedule_slot_id uuid
    REFERENCES public.institution_weekly_schedule(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_teacher_date_slot
  ON public.payroll_entries (teacher_id, class_date, schedule_slot_id)
  WHERE schedule_slot_id IS NOT NULL;

COMMENT ON COLUMN public.payroll_entries.entry_status IS 'as_scheduled=기본대로, custom=시간수정, skipped=수업안함';
COMMENT ON COLUMN public.payroll_entries.schedule_slot_id IS 'institution_weekly_schedule 슬롯과 1:1 매칭';
