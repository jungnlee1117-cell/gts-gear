-- 반복 할 일: 매월 인스턴스 생성 + 매일 기간 창 알림(기존 due cron과 함께)
-- Supabase SQL Editor에서 실행. YOUR_SERVICE_ROLE_KEY 를 실제 키로 교체.
--
-- 사전 조건:
--   1. todo_recurrences.sql 적용
--   2. send-push 재배포 (todo_recurrence_spawn / todo_window 로직 포함)
--   3. pg_cron, pg_net 활성화

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 매월 1일 KST 00:10 = UTC 전월 15:10 ──
-- cron: '10 15 1 * *' → 매월 1일 15:10 UTC = KST 00:10
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'todo-recurrence-monthly-spawn' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'todo-recurrence-monthly-spawn',
  '10 15 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"event":"todo_recurrence_spawn","payload":{}}'::jsonb
  );
  $$
);

-- 기존 push-todo-due-today-daily(KST 08:30)는 유지.
-- send-push의 todo_due_today 핸들러가 일회성 마감 + 반복 기간 창 알림을 함께 처리.
