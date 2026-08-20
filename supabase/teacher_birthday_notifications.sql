-- 선생님 생일 정보 + 오전 8시 슈퍼관리자 푸시 알림
-- Supabase SQL Editor에서 실행한 뒤 send-push, kiosk 함수를 재배포하세요.
-- YOUR_SERVICE_ROLE_KEY는 Project Settings > API의 service_role 키로 교체합니다.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.teachers.birth_date IS
  '선생님 생년월일. 생일 알림 및 키오스크 당일 축하 슬라이드에 사용';

CREATE TABLE IF NOT EXISTS public.teacher_birthday_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  birthday_date date NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_birthday_push_log_unique UNIQUE (teacher_id, birthday_date)
);

ALTER TABLE public.teacher_birthday_push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_birthday_push_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.teacher_birthday_push_log TO service_role;

CREATE INDEX IF NOT EXISTS teacher_birthday_push_log_date_idx
  ON public.teacher_birthday_push_log (birthday_date DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'push-teacher-birthday-daily'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

-- 매일 UTC 23:00 = 한국시간 다음 날 오전 08:00
SELECT cron.schedule(
  'push-teacher-birthday-daily',
  '0 23 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'apikey', 'YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"event":"cron_teacher_birthday_reminders","payload":{}}'::jsonb
  ) AS request_id;
  $cron$
);

-- 확인용
-- SELECT jobid, jobname, schedule, active
-- FROM cron.job
-- WHERE jobname = 'push-teacher-birthday-daily';
