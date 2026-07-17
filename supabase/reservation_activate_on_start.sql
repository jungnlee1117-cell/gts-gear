-- 예약 시작일(KST)에 rental_items 를 자동으로 대여 중(rented)으로 전환
-- Supabase SQL Editor에서 실행하세요.
--
-- 동작:
--   1. 승인 시 시작일이 미래면 rental_items.status = 'pending' 으로 보유(재고 예약)
--   2. start_date 당일부터 activate_due_reservations() 가 status = 'rented' 로 전환
--   3. pg_cron 이 매일 KST 00:05 경에 실행 (UTC 15:05)
--
-- 사전 조건:
--   Database > Extensions: pg_cron 활성화

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 시작일이 된(또는 지난) 확정 예약의 pending 교구를 rented 로 전환
CREATE OR REPLACE FUNCTION public.activate_due_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (timezone('Asia/Seoul', now()))::date;
  v_count integer := 0;
BEGIN
  WITH due AS (
    SELECT ri.id
    FROM public.rental_items ri
    JOIN public.rental_requests rr ON rr.id = ri.request_id
    JOIN public.reservations res ON res.rental_request_id = rr.id
    WHERE res.status = 'confirmed'
      AND res.start_date <= v_today
      AND ri.status = 'pending'
  ),
  updated AS (
    UPDATE public.rental_items ri
    SET
      status = 'rented',
      approved_at = COALESCE(ri.approved_at, now())
    FROM due
    WHERE ri.id = due.id
    RETURNING ri.id
  )
  SELECT count(*)::integer INTO v_count FROM updated;

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.activate_due_reservations() IS
  '확정 예약의 시작일(KST)이 되면 연결 rental_items 를 pending → rented 로 전환';

GRANT EXECUTE ON FUNCTION public.activate_due_reservations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_due_reservations() TO service_role;

-- 이미 승인되어 미래 시작일인데 rented 로 남아 있는 건 되돌림 (반납 기록 없는 경우만)
UPDATE public.rental_items ri
SET status = 'pending'
FROM public.rental_requests rr
JOIN public.reservations res ON res.rental_request_id = rr.id
WHERE ri.request_id = rr.id
  AND res.status = 'confirmed'
  AND res.start_date > (timezone('Asia/Seoul', now()))::date
  AND ri.status = 'rented'
  AND NOT EXISTS (
    SELECT 1
    FROM public.return_requests ret
    WHERE ret.rental_item_id = ri.id
  );

-- 기존 스케줄 제거 후 재등록
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id
  FROM cron.job
  WHERE jobname = 'activate-due-reservations-daily'
  LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- 매일 UTC 15:05 = KST 00:05
SELECT cron.schedule(
  'activate-due-reservations-daily',
  '5 15 * * *',
  $$ SELECT public.activate_due_reservations(); $$
);
