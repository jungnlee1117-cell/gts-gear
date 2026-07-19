-- notices: 기관 공개 범위 (institution_id) + 행사 일정 기간/유형
-- Supabase SQL Editor에서 실행
--
-- notices_select RLS는 이 파일에서 만들지 않음.
-- (manages_institution 의존) → notices_audience_patch.sql 의 select 정책을 사용.

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS event_end_date date;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS exception_type text;

COMMENT ON COLUMN public.notices.institution_id IS
  'NULL=전체 공개. 값이 있으면 해당 기관 담당 선생님·담당 관리자(+슈퍼관리자)만 조회';
COMMENT ON COLUMN public.notices.event_end_date IS
  '행사 종료일 (선택). event_date와 함께 institution_schedule_exceptions.end_date로 동기화';
COMMENT ON COLUMN public.notices.exception_type IS
  '연동 예외 유형: cancelled|event|time_change';

CREATE INDEX IF NOT EXISTS idx_notices_institution_id
  ON public.notices (institution_id)
  WHERE institution_id IS NOT NULL;
