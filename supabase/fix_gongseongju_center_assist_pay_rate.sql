-- 공성주 센터보조 단가 적용일 — 5월 수업부터 급여 반영
UPDATE public.teacher_pay_rates
SET effective_from = '2026-03-01'
WHERE teacher_id = (SELECT id FROM public.teachers WHERE name = '공성주' LIMIT 1)
  AND pay_type = '센터보조'
  AND effective_from > '2026-05-01';
