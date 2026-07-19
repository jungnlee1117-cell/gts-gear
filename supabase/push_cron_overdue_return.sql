-- 교구 연체 리마인드: 로그 테이블 + pg_cron (매일 KST 09:00 = UTC 00:00)
-- Supabase SQL Editor에서 실행
-- 사전: send-push Edge Function에 cron_overdue_return_reminders 배포, pg_cron/pg_net 활성

CREATE TABLE IF NOT EXISTS public.rental_overdue_push_log (
  rental_item_id uuid NOT NULL REFERENCES public.rental_items(id) ON DELETE CASCADE,
  remind_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  had_rotation_conflict boolean NOT NULL DEFAULT false,
  PRIMARY KEY (rental_item_id, remind_date)
);

CREATE INDEX IF NOT EXISTS rental_overdue_push_log_remind_date_idx
  ON public.rental_overdue_push_log (remind_date DESC);

COMMENT ON TABLE public.rental_overdue_push_log IS
  '연체 푸시 중복 방지 (같은 대여 항목·같은 날 1회)';

ALTER TABLE public.rental_overdue_push_log ENABLE ROW LEVEL SECURITY;

-- service role만 사용 (앱/anon 직접 접근 불필요). 정책 없이 RLS on = 차단.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'push-overdue-return-reminders-daily' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- 매일 UTC 00:00 = KST 09:00
-- YOUR_SERVICE_ROLE_KEY 를 실제 service_role 키로 교체하세요.
SELECT cron.schedule(
  'push-overdue-return-reminders-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"event":"cron_overdue_return_reminders","payload":{}}'::jsonb
  ) AS request_id;
  $$
);
