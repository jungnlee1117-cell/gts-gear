-- 정산정보 전체보기 감사 로그 (additive only)
-- 조회자·대상 선생님·필드명·시각만 저장. 계좌번호/주민등록번호 원문은 컬럼 없음.
-- Supabase SQL Editor에서 실행 후 Edge Function teacher-hr 을 재배포.

CREATE TABLE IF NOT EXISTS public.teacher_settlement_reveal_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES public.teachers(id),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id),
  fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_settlement_reveal_audit_fields_allowed
    CHECK (fields <@ ARRAY['account_number', 'resident_id']::text[])
);

CREATE INDEX IF NOT EXISTS teacher_settlement_reveal_audit_created_idx
  ON public.teacher_settlement_reveal_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS teacher_settlement_reveal_audit_teacher_idx
  ON public.teacher_settlement_reveal_audit (teacher_id, created_at DESC);

COMMENT ON TABLE public.teacher_settlement_reveal_audit IS
  '정산정보 전체보기 감사 로그. 누가 언제 어떤 필드(account_number, resident_id)를 조회했는지. 원문 저장 금지.';
COMMENT ON COLUMN public.teacher_settlement_reveal_audit.viewer_id IS '전체보기를 실행한 사용자';
COMMENT ON COLUMN public.teacher_settlement_reveal_audit.teacher_id IS '조회 대상 선생님';
COMMENT ON COLUMN public.teacher_settlement_reveal_audit.fields IS '복호화되어 반환된 필드명만. 원문 없음.';

ALTER TABLE public.teacher_settlement_reveal_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.teacher_settlement_reveal_audit FROM anon, authenticated;
GRANT ALL ON public.teacher_settlement_reveal_audit TO service_role;
