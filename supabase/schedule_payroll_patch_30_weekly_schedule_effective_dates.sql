-- institution_weekly_schedule: 수업 유효 기간 (시작일~종료일)
-- schedule_payroll_patch_29 이후 실행

ALTER TABLE public.institution_weekly_schedule
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;

ALTER TABLE public.institution_weekly_schedule
  DROP CONSTRAINT IF EXISTS institution_weekly_schedule_effective_range_check;

ALTER TABLE public.institution_weekly_schedule
  ADD CONSTRAINT institution_weekly_schedule_effective_range_check
  CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  );

COMMENT ON COLUMN public.institution_weekly_schedule.effective_from IS
  '주간 슬롯 적용 시작일. NULL이면 제한 없음';
COMMENT ON COLUMN public.institution_weekly_schedule.effective_to IS
  '주간 슬롯 적용 종료일. NULL이면 무기한';
