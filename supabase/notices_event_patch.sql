-- 공지 ↔ 행사 일정 연동
-- notices_event_patch.sql — Supabase SQL Editor에서 실행

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS notice_type text NOT NULL DEFAULT 'general';

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS event_date date;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS event_time text;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS event_location text;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS schedule_exception_ids uuid[] DEFAULT '{}';

DO $$
BEGIN
  ALTER TABLE public.notices
    ADD CONSTRAINT notices_notice_type_check CHECK (notice_type IN ('general', 'event'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.notices.notice_type IS 'general=일반·공고, event=행사';
COMMENT ON COLUMN public.notices.event_date IS '행사 날짜 (notice_type=event)';
COMMENT ON COLUMN public.notices.event_time IS '행사 시간 (예: 14:00 또는 14:00-16:00)';
COMMENT ON COLUMN public.notices.event_location IS '행사 장소';
COMMENT ON COLUMN public.notices.schedule_exception_ids IS '연동된 institution_schedule_exceptions id 목록';

ALTER TABLE public.institution_schedule_exceptions
  ADD COLUMN IF NOT EXISTS notice_id uuid REFERENCES public.notices(id) ON DELETE CASCADE;

ALTER TABLE public.institution_schedule_exceptions
  ADD COLUMN IF NOT EXISTS event_location text;

CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_notice_id
  ON public.institution_schedule_exceptions(notice_id)
  WHERE notice_id IS NOT NULL;

COMMENT ON COLUMN public.institution_schedule_exceptions.notice_id IS '연동 공지 (공지 삭제 시 CASCADE)';
COMMENT ON COLUMN public.institution_schedule_exceptions.event_location IS '행사 장소 (공지 연동 시)';
