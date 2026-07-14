-- institutions.manager_id (담당 관리자) + assignments.role (manager|teacher)
-- Supabase SQL Editor에서 실행

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.teachers(id);

COMMENT ON COLUMN public.institutions.manager_id IS
  '기관 담당 관리자 (양의인·오정석 등). 수업 선생님과 별개';

ALTER TABLE public.institution_teacher_assignments
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'teacher';

ALTER TABLE public.institution_teacher_assignments
  DROP CONSTRAINT IF EXISTS institution_teacher_assignments_role_check;

ALTER TABLE public.institution_teacher_assignments
  ADD CONSTRAINT institution_teacher_assignments_role_check
  CHECK (role IN ('manager', 'teacher'));

COMMENT ON COLUMN public.institution_teacher_assignments.role IS
  'manager=담당자(보조 기록), teacher=수업 선생님. 담당자의 소스는 institutions.manager_id';

-- 기존 배정은 수업 선생님으로 취급
UPDATE public.institution_teacher_assignments
SET role = 'teacher'
WHERE role IS NULL OR role NOT IN ('manager', 'teacher');

CREATE INDEX IF NOT EXISTS idx_assignments_role
  ON public.institution_teacher_assignments (institution_id, role)
  WHERE is_active = true;

-- 기존 institutions.manager_id 를 assignments role=manager 로 보조 동기화
-- (이미 teacher로 배정된 사람은 manager 행을 만들지 않음 — UNIQUE 충돌 방지)
INSERT INTO public.institution_teacher_assignments (
  institution_id, teacher_id, pay_types, is_active, role
)
SELECT
  i.id,
  i.manager_id,
  '{}'::text[],
  true,
  'manager'
FROM public.institutions i
WHERE i.manager_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.institution_teacher_assignments a
    WHERE a.institution_id = i.id
      AND a.teacher_id = i.manager_id
  )
ON CONFLICT (institution_id, teacher_id) DO NOTHING;
