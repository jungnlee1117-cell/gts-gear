-- 공성주 지니어스 월요일 13:40~14:10 방과후 → 정규

UPDATE public.institution_weekly_schedule
SET class_type = '정규'
WHERE id = 'c562c9e9-deff-4ccb-8555-0418179af123'
  AND teacher_id = (SELECT id FROM public.teachers WHERE name = '공성주' LIMIT 1);

UPDATE public.payroll_entries
SET pay_type = '정규', updated_at = now()
WHERE schedule_slot_id = 'c562c9e9-deff-4ccb-8555-0418179af123'
  AND pay_type = '방과후';
