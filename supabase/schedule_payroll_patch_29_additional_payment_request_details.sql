-- additional_payment_requests: 수업 일시·장소 컬럼 추가
-- 기존 create / patch 25 테이블에 대해 안전하게 재실행 가능

ALTER TABLE public.additional_payment_requests
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN public.additional_payment_requests.event_date IS
  '추가수당 발생(수업) 날짜';
COMMENT ON COLUMN public.additional_payment_requests.start_time IS
  '시작 시간';
COMMENT ON COLUMN public.additional_payment_requests.end_time IS
  '종료 시간';
COMMENT ON COLUMN public.additional_payment_requests.location IS
  '수업 장소/기관';
