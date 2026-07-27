-- 지티 리포트 — 15일마다 Edge Function 호출
-- Supabase SQL Editor에서 실행하세요.
--
-- 사전 조건:
--   1. giti_usage_and_reports.sql 적용
--   2. Edge Function giti-biweekly-report 배포
--   3. Secrets: ANTHROPIC_API_KEY, GITI_APPS_SCRIPT_URL,
--      GITI_APPS_SCRIPT_SECRET(선택), GITI_REPORT_FOLDER_ID, SUPER_ADMIN_ID
--   4. Apps Script 웹앱 배포 (giti_report_apps_script.gs) 후 URL 등록
--   5. YOUR_SERVICE_ROLE_KEY 교체
--   6. pg_cron, pg_net 활성화
--
-- 스케줄: 매월 1일·16일 UTC 00:00 (= KST 09:00) ≈ 15일 간격
-- Edge Function 내부에서도 최근 리포트 14일 이내면 스킵합니다.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'giti-biweekly-report' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'giti-biweekly-report',
  '0 0 1,16 * *',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/giti-biweekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"force":false}'::jsonb
  ) AS request_id;
  $$
);

-- 확인:
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'giti-biweekly-report';
--
-- 수동 실행:
--   SELECT net.http_post(
--     url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/giti-biweekly-report',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     ),
--     body := '{"force":true}'::jsonb
--   );
