-- 공지사항 테이블 (GTS 교구 앱)
-- "이번달 내교구" / 공지사항 화면에서 사용
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요.
--
-- 앱 참조 (src/App.jsx):
--   SELECT * … ORDER BY created_at DESC          — fetchNotices, loadAll
--   INSERT title, body, importance, author_id, author_name — persistNotice
--   UPDATE title, body, importance, updated_at — updateNoticeRecord, updateNotice
--   DELETE BY id                               — removeNotice
--
-- UI 표시 필드 (NoticesFeedCard, NoticeDetailModal):
--   title, body, importance, author_name, created_at, updated_at

CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  importance text NOT NULL DEFAULT 'normal',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT notices_importance_check CHECK (importance IN ('normal', 'important'))
);

-- 기존 환경에 테이블만 있고 컬럼이 빠진 경우 보강
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS importance text NOT NULL DEFAULT 'normal';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.notices
    ADD CONSTRAINT notices_importance_check CHECK (importance IN ('normal', 'important'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);

COMMENT ON TABLE public.notices IS '교구 앱 공지사항';
COMMENT ON COLUMN public.notices.title IS '공지 제목';
COMMENT ON COLUMN public.notices.body IS '공지 내용';
COMMENT ON COLUMN public.notices.importance IS 'normal=일반, important=공고';
COMMENT ON COLUMN public.notices.author_id IS '작성자 (auth.users.id)';
COMMENT ON COLUMN public.notices.author_name IS '작성자 표시명';
COMMENT ON COLUMN public.notices.created_at IS '작성일';
COMMENT ON COLUMN public.notices.updated_at IS '수정일';

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자 전체 조회 (선생님 홈·공지 목록)
DROP POLICY IF EXISTS "notices_select" ON public.notices;
CREATE POLICY "notices_select" ON public.notices
  FOR SELECT TO authenticated
  USING (true);

-- 작성·수정·삭제: 스케줄 관리자 (role admin/superadmin) — isGearPlatformAdmin 과 동일
DROP POLICY IF EXISTS "notices_insert_admin" ON public.notices;
CREATE POLICY "notices_insert_admin" ON public.notices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "notices_update_admin" ON public.notices;
CREATE POLICY "notices_update_admin" ON public.notices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "notices_delete_superadmin" ON public.notices;
DROP POLICY IF EXISTS "notices_delete_admin" ON public.notices;
CREATE POLICY "notices_delete_admin" ON public.notices
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );
