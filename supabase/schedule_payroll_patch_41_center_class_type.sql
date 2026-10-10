-- 주간 시간표 class_type에 「센터」를 허용한다.
-- 급여 pay_type은 이미 센터를 허용하고, 화면의 수업 유형도 센터를 쓴다.

ALTER TABLE public.institution_weekly_schedule
  DROP CONSTRAINT IF EXISTS institution_weekly_schedule_class_type_check;

ALTER TABLE public.institution_weekly_schedule
  ADD CONSTRAINT institution_weekly_schedule_class_type_check
  CHECK (class_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text, '참관수업'::text, '센터'::text
  ]));

UPDATE public.institution_weekly_schedule
SET class_type = '센터'
WHERE id = 'bdc8a1d3-5687-4937-bb03-c45a578113f3'
  AND teacher_id = 'df8048a8-8691-4cf5-9cbd-4fca29911090'
  AND institution_id = '7f0b5a75-4cc0-488b-b659-968d237b4197'
  AND class_type = '정규';

UPDATE public.payroll_entries
SET pay_type = '센터'
WHERE teacher_id = 'df8048a8-8691-4cf5-9cbd-4fca29911090'
  AND institution_id = '7f0b5a75-4cc0-488b-b659-968d237b4197'
  AND schedule_slot_id = 'bdc8a1d3-5687-4937-bb03-c45a578113f3'
  AND pay_type = '정규'
  AND id IN (
    'dc45a497-772e-4dbb-b51a-3e577d7be0d7',
    'd8db1d20-0039-410f-8c16-938b78c33821',
    '4cdc2490-aea6-48aa-9461-948a952de648',
    '0c40b88b-46ba-4256-ba98-4c64d55d65dd',
    'd55e74a5-5678-4a6c-9c77-c1eb96eb916f'
  );
