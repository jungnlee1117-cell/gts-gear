-- 원 단위 전체/오전/오후 휴강 유형 추가
-- 기존 cancelled 값은 전체휴강으로 유지합니다.

ALTER TABLE public.institution_schedule_exceptions
  DROP CONSTRAINT IF EXISTS institution_schedule_exceptions_exception_type_check;

ALTER TABLE public.institution_schedule_exceptions
  ADD CONSTRAINT institution_schedule_exceptions_exception_type_check
  CHECK (
    exception_type IN (
      'cancelled',
      'cancelled_am',
      'cancelled_pm',
      'event',
      'time_change'
    )
  );

COMMENT ON COLUMN public.institution_schedule_exceptions.exception_type IS
  'cancelled=전체휴강, cancelled_am=오전휴강, cancelled_pm=오후휴강, event=행사, time_change=시간변경';

COMMENT ON COLUMN public.notices.exception_type IS
  '연동 예외 유형: cancelled|cancelled_am|cancelled_pm|event|time_change';
