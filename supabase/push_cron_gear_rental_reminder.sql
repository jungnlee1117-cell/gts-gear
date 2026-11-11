-- 정규수업 배정 교구 미대여 알림 — pg_cron 3개
-- Supabase SQL Editor 에서 실행하세요. (YOUR_SERVICE_ROLE_KEY 를 실제 service_role 키로 교체)
--
--   일요일 20:00 KST (UTC 일 11:00)  preview : 선생님에게 "월요일부터 쓸 배정 교구, 아직 안 빌렸다면 대여해 주세요"
--   월요일 08:30 KST (UTC 일 23:30)  monday  : 아직 미대여인 선생님에게 재알림 + 관리자 공지사항 게시 + 관리자 푸시
--   화요일 08:30 KST (UTC 월 23:30)  tuesday : 여전히 미대여인 선생님에게 재알림 + 관리자 공지사항(화요일 재확인) + 관리자 푸시
--
-- 사전 조건: send-push Edge Function 최신 배포, pg_cron / pg_net 활성화
-- 공지사항은 audience_type = 'item_admins' (교구관리자·슈퍼관리자만 보임) 로 올라갑니다.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('gear-rental-reminder-preview', 'gear-rental-reminder-monday', 'gear-rental-reminder-tuesday')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'gear-rental-reminder-preview',
  '0 11 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
    body := '{"event":"cron_gear_rental_reminder","payload":{"mode":"preview"}}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'gear-rental-reminder-monday',
  '30 23 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
    body := '{"event":"cron_gear_rental_reminder","payload":{"mode":"monday"}}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'gear-rental-reminder-tuesday',
  '30 23 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
    body := '{"event":"cron_gear_rental_reminder","payload":{"mode":"tuesday"}}'::jsonb
  ) AS request_id;
  $$
);

-- 확인: SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'gear-rental-reminder-%';
--
-- 수동 테스트 (알림·공지가 실제로 발송됩니다):
--   SELECT net.http_post(
--     url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
--     body := '{"event":"cron_gear_rental_reminder","payload":{"mode":"monday"}}'::jsonb
--   );
