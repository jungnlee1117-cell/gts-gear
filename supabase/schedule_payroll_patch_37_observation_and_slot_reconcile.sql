-- 참관수업(회당 15,000원) 유형 추가 + 스케줄 버전 변경 급여 연결 보정
-- 앱 계산에서는 참관수업 pay_type 1건을 진행시간과 관계없이 15,000원으로 계산합니다.

ALTER TABLE public.institution_weekly_schedule
  DROP CONSTRAINT IF EXISTS institution_weekly_schedule_class_type_check;

ALTER TABLE public.institution_weekly_schedule
  ADD CONSTRAINT institution_weekly_schedule_class_type_check
  CHECK (class_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text, '참관수업'::text
  ]));

ALTER TABLE public.teacher_pay_rates
  DROP CONSTRAINT IF EXISTS teacher_pay_rates_pay_type_check;

ALTER TABLE public.teacher_pay_rates
  ADD CONSTRAINT teacher_pay_rates_pay_type_check
  CHECK (pay_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text,
    '가정방문'::text, '센터'::text, '센터보조'::text, '참관수업'::text
  ]));

ALTER TABLE public.payroll_entries
  DROP CONSTRAINT IF EXISTS payroll_entries_pay_type_check;

ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_pay_type_check
  CHECK (pay_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text,
    '가정방문'::text, '센터'::text, '센터보조'::text, '참관수업'::text
  ]));

ALTER TABLE public.temp_teachers
  DROP CONSTRAINT IF EXISTS temp_teachers_pay_type_check;

ALTER TABLE public.temp_teachers
  ADD CONSTRAINT temp_teachers_pay_type_check
  CHECK (pay_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text,
    '가정방문'::text, '센터'::text, '센터보조'::text, '참관수업'::text
  ]));

-- 과거 스케줄 버전에 남아 있는 급여 행을 해당 날짜에 유효한 최신 버전으로 이동합니다.
-- 직접 수정(custom)한 분은 보존하고 기본 확정(as_scheduled)만 최신 슬롯 시간으로 맞춥니다.
WITH active_slot AS (
  SELECT
    pe.id AS payroll_id,
    current_slot.id AS slot_id,
    current_slot.institution_id,
    current_slot.teacher_id,
    CASE
      WHEN current_slot.label LIKE '센터보조%' THEN '센터보조'
      ELSE current_slot.class_type
    END AS pay_type,
    GREATEST(
      0,
      ROUND(EXTRACT(EPOCH FROM (current_slot.end_time - current_slot.start_time)) / 60)::integer
    ) AS scheduled_minutes,
    pe.entry_status,
    ROW_NUMBER() OVER (
      PARTITION BY pe.id
      ORDER BY current_slot.effective_from DESC NULLS LAST, current_slot.updated_at DESC NULLS LAST
    ) AS rn
  FROM public.payroll_entries pe
  JOIN public.institution_weekly_schedule old_slot
    ON old_slot.id = pe.schedule_slot_id
  JOIN public.institution_weekly_schedule current_slot
    ON COALESCE(current_slot.schedule_series_id, current_slot.id)
       = COALESCE(old_slot.schedule_series_id, old_slot.id)
   AND current_slot.day_of_week = EXTRACT(DOW FROM pe.class_date)::integer
   AND (current_slot.effective_from IS NULL OR current_slot.effective_from <= pe.class_date)
   AND (current_slot.effective_to IS NULL OR current_slot.effective_to >= pe.class_date)
)
UPDATE public.payroll_entries pe
SET
  schedule_slot_id = a.slot_id,
  institution_id = a.institution_id,
  teacher_id = a.teacher_id,
  pay_type = a.pay_type,
  minutes = CASE
    WHEN pe.entry_status = 'as_scheduled' THEN a.scheduled_minutes
    ELSE pe.minutes
  END,
  updated_at = now()
FROM active_slot a
WHERE a.payroll_id = pe.id
  AND a.rn = 1
  AND (
    pe.schedule_slot_id IS DISTINCT FROM a.slot_id
    OR pe.institution_id IS DISTINCT FROM a.institution_id
    OR pe.teacher_id IS DISTINCT FROM a.teacher_id
    OR pe.pay_type IS DISTINCT FROM a.pay_type
    OR (pe.entry_status = 'as_scheduled' AND pe.minutes IS DISTINCT FROM a.scheduled_minutes)
  );

COMMENT ON COLUMN public.institution_weekly_schedule.class_type IS
  '정규 | 방과후 | 어린이집 | 참관수업 (참관수업은 앱에서 회당 15,000원 고정 계산)';
