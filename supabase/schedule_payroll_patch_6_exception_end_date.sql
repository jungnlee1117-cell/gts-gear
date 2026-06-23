-- institution_schedule_exceptions: 기간(end_date) 지원
-- schedule_payroll_patch_5_schedule_slot_id.sql 실행 후 적용

ALTER TABLE public.institution_schedule_exceptions
  ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE public.institution_schedule_exceptions
  DROP CONSTRAINT IF EXISTS institution_schedule_exceptions_date_range_check;

ALTER TABLE public.institution_schedule_exceptions
  ADD CONSTRAINT institution_schedule_exceptions_date_range_check
  CHECK (end_date IS NULL OR end_date >= exception_date);

COMMENT ON COLUMN public.institution_schedule_exceptions.end_date IS
  '기간 종료일. NULL이면 exception_date 단일일 안내';
