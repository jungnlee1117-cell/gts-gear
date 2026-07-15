-- notice_reads: 공지사항 읽음 확인
-- Supabase SQL Editor에서 실행
-- 선행: notices 테이블, notices_audience_patch.sql (선택)

CREATE TABLE IF NOT EXISTS public.notice_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notice_reads_notice_teacher_unique UNIQUE (notice_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_reads_notice_id
  ON public.notice_reads (notice_id);

CREATE INDEX IF NOT EXISTS idx_notice_reads_teacher_id
  ON public.notice_reads (teacher_id);

CREATE INDEX IF NOT EXISTS idx_notice_reads_notice_teacher
  ON public.notice_reads (notice_id, teacher_id);

COMMENT ON TABLE public.notice_reads IS '공지사항 읽음 기록';
COMMENT ON COLUMN public.notice_reads.notice_id IS '공지 id';
COMMENT ON COLUMN public.notice_reads.teacher_id IS '읽은 선생님 (teachers.id = auth.uid())';
COMMENT ON COLUMN public.notice_reads.read_at IS '읽은 시각';

ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;

-- 본인 읽음 기록 조회 + 관리자 전체 조회
DROP POLICY IF EXISTS "notice_reads_select" ON public.notice_reads;
CREATE POLICY "notice_reads_select" ON public.notice_reads
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('admin', 'superadmin')
    )
  );

-- 본인만 읽음 등록
DROP POLICY IF EXISTS "notice_reads_insert" ON public.notice_reads;
CREATE POLICY "notice_reads_insert" ON public.notice_reads
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- upsert 시 본인 행 갱신
DROP POLICY IF EXISTS "notice_reads_update" ON public.notice_reads;
CREATE POLICY "notice_reads_update" ON public.notice_reads
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- 본인 삭제 (선택)
DROP POLICY IF EXISTS "notice_reads_delete" ON public.notice_reads;
CREATE POLICY "notice_reads_delete" ON public.notice_reads
  FOR DELETE TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('admin', 'superadmin')
    )
  );
