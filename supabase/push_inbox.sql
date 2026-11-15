-- 알림 모아보기: 보낸 푸시를 받는 사람별로 저장 (앱 종 아이콘에서 확인)
CREATE TABLE IF NOT EXISTS public.push_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/gear',
  tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_inbox_teacher_created_idx
  ON public.push_inbox (teacher_id, created_at DESC);

ALTER TABLE public.push_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_inbox_select_own ON public.push_inbox;
CREATE POLICY push_inbox_select_own ON public.push_inbox
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS push_inbox_update_own ON public.push_inbox;
CREATE POLICY push_inbox_update_own ON public.push_inbox
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- 저장은 send-push(서비스 롤)만 한다. 앱에서는 읽기/읽음 처리만 가능.

-- 30일 지난 알림 자동 삭제 (매일 새벽 4시 KST = UTC 19:00)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'push-inbox-cleanup' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;
SELECT cron.schedule('push-inbox-cleanup', '0 19 * * *',
  $$DELETE FROM public.push_inbox WHERE created_at < now() - interval '30 days';$$);
