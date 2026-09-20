-- 수업 종료 후 완료 확인 푸시 (1차: 마지막 수업+10분, 2차: +1시간, 3차: 20:00)
--
-- pg_cron 은 DB 안에서 send-push Edge Function 을 HTTP 로 호출합니다.
-- send-push 는 Authorization Bearer 가 Edge Function 의 SERVICE_ROLE_KEY 와
-- 같을 때만 cron_class_checkin 을 실행합니다. (로그인 JWT 로는 이 이벤트가 거부됨)
--
-- 키는 이 파일에 넣지 마세요. Dashboard → Project Settings → Vault 에
-- 이름 `service_role_key` 로 service_role 키를 한 번만 저장한 뒤 이 SQL 을 실행하세요.
-- (SQL Editor 에서 일회성으로 vault.create_secret(...) 를 써도 됩니다. 그 문장은 커밋하지 마세요.)

CREATE TABLE IF NOT EXISTS public.class_checkin_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_date date NOT NULL,
  round smallint NOT NULL CHECK (round IN (1, 2, 3)),
  last_end_time time,
  unconfirmed_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_checkin_pushes_unique UNIQUE (teacher_id, class_date, round)
);

COMMENT ON TABLE public.class_checkin_pushes IS
  '수업 체크인 푸시 발송 로그. 완료 상태가 아니라 1/2/3차 중복 방지용.';

CREATE INDEX IF NOT EXISTS class_checkin_pushes_date_idx
  ON public.class_checkin_pushes (class_date DESC, round);

ALTER TABLE public.class_checkin_pushes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.class_checkin_pushes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.class_checkin_pushes TO service_role;

CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- pg_cron → send-push 호출. 키는 실행 시점에 Vault 에서만 읽음.
CREATE OR REPLACE FUNCTION public.invoke_send_push_cron(event_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, extensions, pg_temp
AS $$
DECLARE
  secret_key text;
  request_id bigint;
BEGIN
  SELECT ds.decrypted_secret INTO secret_key
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'service_role_key'
  LIMIT 1;

  IF secret_key IS NULL OR length(btrim(secret_key)) = 0 THEN
    RAISE EXCEPTION
      'Vault secret "service_role_key" 가 없습니다. Dashboard → Project Settings → Vault 에 service_role 키를 저장하세요.';
  END IF;

  SELECT net.http_post(
    url := 'https://ivphpmjaddrubshchxck.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret_key,
      'apikey', secret_key
    ),
    body := jsonb_build_object(
      'event', event_name,
      'payload', jsonb_build_object()
    )
  ) INTO request_id;

  RETURN request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_send_push_cron(text) IS
  'pg_cron 전용. send-push 를 Vault 의 service_role_key 로 호출한다. 키는 함수/크론 SQL 에 저장되지 않는다.';

REVOKE ALL ON FUNCTION public.invoke_send_push_cron(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_send_push_cron(text) TO postgres;

DO $$
DECLARE
  existing_job_id bigint;
  secret_key text;
BEGIN
  SELECT ds.decrypted_secret INTO secret_key
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'service_role_key'
  LIMIT 1;

  IF secret_key IS NULL OR length(btrim(secret_key)) = 0 THEN
    RAISE EXCEPTION
      'Vault secret "service_role_key" 가 없습니다. Dashboard → Project Settings → Vault 에 이름을 service_role_key 로 저장한 뒤 이 SQL 을 다시 실행하세요.';
  END IF;

  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'push-class-checkin'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

-- 5분마다. 각 선생님 마지막 수업 종료+10분 / +1시간 / 당일 20:00 창을 검사
SELECT cron.schedule(
  'push-class-checkin',
  '*/5 * * * *',
  $cron$SELECT public.invoke_send_push_cron('cron_class_checkin');$cron$
);

-- 확인용
-- SELECT jobid, jobname, schedule, command, active FROM cron.job WHERE jobname = 'push-class-checkin';
-- SELECT name FROM vault.decrypted_secrets WHERE name = 'service_role_key';
