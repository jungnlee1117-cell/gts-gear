-- 할 일 당일 마감 푸시 알림 — pg_cron 매일 KST 08:30 (UTC 23:30)
-- Supabase SQL Editor에서 실행하세요.
--
-- 사전 조건:
--   1. send-push Edge Function 배포 (todo_due_today 이벤트 포함) 및 VAPID 시크릿 설정
--   2. Database > Extensions: pg_cron, pg_net 활성화
--   3. YOUR_SERVICE_ROLE_KEY 를 실제 Service Role Key로 교체
--      (Dashboard → Project Settings → API → service_role)
--
-- 동작:
--   - 미완료 + due_date = 오늘(KST) 인 admin_todos 조회
--   - 담당자(있으면면 전체 관리자) + 슈퍼관리자에게 푸시
--   - 메시지: "오늘 마감: [할 일 제목]"

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 기존 스케줄 제거 (재실행 시)
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'push-todo-due-today-daily' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- 매일 UTC 23:30 = KST 08:30
SELECT cron.schedule(
  'push-todo-due-today-daily',
  '30 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cGhwbWphZGRydWJzaGNoeGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk2NTI2OCwiZXhwIjoyMDk1NTQxMjY4fQ.0twDhSrdCbHbCGXrBaulKqBFe-E8mRYkqkZdS8bShl0'
      
    ),
    body := '{"event":"todo_due_today","payload":{}}'::jsonb
  ) AS request_id;
  $$
);

-- 등록 확인:
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'push-todo-due-today-daily';
--
-- 수동 테스트 (SQL Editor → 또는 curl):
--   SELECT net.http_post(
--     url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     ),
--     body := '{"event":"todo_due_today","payload":{}}'::jsonb
--   );
