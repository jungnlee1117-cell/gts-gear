-- 협력업체(와이에이에듀, 올바른키즈)는 선생님 계정을 유지하고
-- 급여 정산정보의 식별번호를 사업자등록번호로 받는다.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS payee_kind text NOT NULL DEFAULT 'teacher';

ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_payee_kind_check;

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_payee_kind_check
  CHECK (payee_kind IN ('teacher', 'partner'));

UPDATE public.teachers
SET payee_kind = 'partner'
WHERE id IN (
  'fd66fde6-e40e-4023-8e39-3b121033d00a',
  '8e584938-88e2-4fe3-b0df-a23550de5ede'
);
