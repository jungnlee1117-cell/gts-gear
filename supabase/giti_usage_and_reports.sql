-- 지티(GiTi) 사용 로그 + 리포트
-- Supabase SQL Editor에서 실행하세요.

-- ── 질문/답변 로그 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.giti_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  session_id text,
  question text NOT NULL,
  question_norm text NOT NULL,
  category text NOT NULL DEFAULT '기타'
    CHECK (category IN ('수업운영', '아이대처', '교구활동', '영어표현', '이벤트', '기타')),
  answer_preview text,
  model text,
  input_tokens int,
  output_tokens int,
  cache_read_input_tokens int,
  cache_creation_input_tokens int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS giti_usage_events_created_at_idx
  ON public.giti_usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS giti_usage_events_teacher_created_idx
  ON public.giti_usage_events (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS giti_usage_events_category_idx
  ON public.giti_usage_events (category);
CREATE INDEX IF NOT EXISTS giti_usage_events_question_norm_idx
  ON public.giti_usage_events (question_norm);

ALTER TABLE public.giti_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS giti_usage_insert_own ON public.giti_usage_events;
CREATE POLICY giti_usage_insert_own ON public.giti_usage_events
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS giti_usage_select_own ON public.giti_usage_events;
CREATE POLICY giti_usage_select_own ON public.giti_usage_events
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role = 'superadmin'
    )
  );

-- ── 리포트 메타 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.giti_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  title text NOT NULL,
  summary text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggestions text,
  google_doc_id text,
  google_doc_url text,
  drive_folder_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS giti_reports_created_at_idx
  ON public.giti_reports (created_at DESC);

ALTER TABLE public.giti_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS giti_reports_select_superadmin ON public.giti_reports;
CREATE POLICY giti_reports_select_superadmin ON public.giti_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role = 'superadmin'
    )
  );

-- service role은 RLS 우회 (Edge Function 집계/삽입)
COMMENT ON TABLE public.giti_usage_events IS '지티 채팅 질문 로그 (15일 리포트용)';
COMMENT ON TABLE public.giti_reports IS '지티 15일 리포트 메타 + Google Docs 링크';
