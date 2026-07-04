-- 반납 기한 D-1 푸시 알림 — pg_cron 매일 KST 08:00 (UTC 23:00)
-- Supabase SQL Editor에서 실행하세요.
--
-- 사전 조건:
--   1. send-push Edge Function 배포 및 VAPID 시크릿 설정
--   2. Database > Extensions: pg_cron, pg_net 활성화
--   3. YOUR_SERVICE_ROLE_KEY 를 실제 값으로 교체
--      (또는 Supabase Vault에 service_role_key 저장 후 decrypted_secrets 사용)

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 기존 스케줄 제거 (재실행 시)
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'push-return-due-reminders-daily' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- 매일 UTC 23:00 = KST 08:00
SELECT cron.schedule(
  'push-return-due-reminders-daily',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"event":"cron_return_due_reminders","payload":{}}'::jsonb
  ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS '반납 D-1 푸시: push-return-due-reminders-daily job 참고';
