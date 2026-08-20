-- 매월 1일 오전 9시(KST)에 직전 달 사업소득 엑셀을 GTS Google Drive에 저장합니다.
-- 실행 전 YOUR_SERVICE_ROLE_KEY를 실제 service role key로 교체하세요.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job
   WHERE jobname = 'gts-monthly-payroll-tax-report' LIMIT 1;
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END $$;

SELECT cron.schedule(
  'gts-monthly-payroll-tax-report',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/payroll-tax-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"action":"upload_previous_month"}'::jsonb
  );
  $$
);
