-- 정규 주간 수업의 생성·변경·종료 이력을 연결합니다.
-- 기존 행은 그대로 유지하고 컬럼만 추가하는 additive migration입니다.

ALTER TABLE public.institution_weekly_schedule
  ADD COLUMN IF NOT EXISTS schedule_series_id uuid,
  ADD COLUMN IF NOT EXISTS previous_slot_id uuid
    REFERENCES public.institution_weekly_schedule(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS changed_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 기존 수업은 자기 자신을 최초 버전으로 사용합니다.
UPDATE public.institution_weekly_schedule
SET schedule_series_id = id
WHERE schedule_series_id IS NULL;

ALTER TABLE public.institution_weekly_schedule
  ALTER COLUMN schedule_series_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN schedule_series_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_schedule_series
  ON public.institution_weekly_schedule(schedule_series_id, effective_from, created_at);

COMMENT ON COLUMN public.institution_weekly_schedule.schedule_series_id IS
  '같은 정규 주간 수업의 변경 버전을 묶는 ID';
COMMENT ON COLUMN public.institution_weekly_schedule.previous_slot_id IS
  '변경 전 바로 이전 수업 슬롯 ID';
COMMENT ON COLUMN public.institution_weekly_schedule.change_reason IS
  '신규 등록·변경·종료 사유';
COMMENT ON COLUMN public.institution_weekly_schedule.changed_by IS
  '변경을 수행한 로그인 사용자';
