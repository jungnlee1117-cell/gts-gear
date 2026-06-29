-- 임시 선생님 급여 방식: 시급 / 일급 / 총금액(고정)
-- schedule_payroll_patch_22 이후 적용

ALTER TABLE public.temp_teachers
  ADD COLUMN IF NOT EXISTS work_hours numeric(8, 2),
  ADD COLUMN IF NOT EXISTS work_days integer;

ALTER TABLE public.temp_teachers
  DROP CONSTRAINT IF EXISTS temp_teachers_pay_mode_check;

ALTER TABLE public.temp_teachers
  ADD CONSTRAINT temp_teachers_pay_mode_check
  CHECK (pay_mode IN ('hourly', 'daily', 'fixed_total', 'per_session'));
