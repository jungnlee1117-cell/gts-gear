-- 공성주 보조수업: Play by GTS 삼성 센터 → 한남센터
-- 한남센터 없으면 생성 후 배정·스케줄 이동

INSERT INTO public.institutions (name, manager_id, contract_type, billing_type, is_active)
SELECT
  '한남센터',
  (SELECT id FROM public.teachers WHERE name = '양의인' LIMIT 1),
  'gts_official',
  'monthly_fixed',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.institutions WHERE name = '한남센터'
);

UPDATE public.institution_teacher_assignments
SET is_active = false
WHERE teacher_id = (SELECT id FROM public.teachers WHERE name = '공성주' LIMIT 1)
  AND institution_id = (
    SELECT id FROM public.institutions WHERE name = 'Play by GTS 삼성 센터' LIMIT 1
  );

INSERT INTO public.institution_teacher_assignments (institution_id, teacher_id, pay_types, is_active)
SELECT
  h.id,
  t.id,
  ARRAY['센터보조']::text[],
  true
FROM public.institutions h, public.teachers t
WHERE h.name = '한남센터' AND t.name = '공성주'
ON CONFLICT (institution_id, teacher_id) DO UPDATE
SET pay_types = EXCLUDED.pay_types, is_active = true;

UPDATE public.institution_weekly_schedule w
SET institution_id = h.id
FROM public.institutions h, public.teachers t, public.institutions s
WHERE h.name = '한남센터'
  AND s.name = 'Play by GTS 삼성 센터'
  AND t.name = '공성주'
  AND w.teacher_id = t.id
  AND w.institution_id = s.id;

UPDATE public.payroll_entries pe
SET institution_id = h.id, updated_at = now()
FROM public.institutions h, public.teachers t, public.institutions s
WHERE h.name = '한남센터'
  AND s.name = 'Play by GTS 삼성 센터'
  AND t.name = '공성주'
  AND pe.teacher_id = t.id
  AND pe.institution_id = s.id
  AND pe.class_date >= '2026-05-01'
  AND pe.class_date <= '2026-06-30';
