-- 김종현 2026-05 payroll_entries 재정렬
-- (점심 슬롯·화요일 방과후 entry 삭제, 방과후 85→80분)
-- fix_kimjonghyun_weekly_schedule.sql 적용 후 실행 (idempotent)

WITH kim AS (SELECT id AS teacher_id FROM public.teachers WHERE name = '김종현' LIMIT 1),
removed_slots AS (
  SELECT unnest(ARRAY[
    'bde10002-016b-4f8f-bd2c-771e46aa9aa9'::uuid,
    'daa6e376-9113-4daf-8260-2e2d1c9d97b1'::uuid,
    '2f9ff774-43b5-426c-a893-313e07878e08'::uuid,
    '0cede120-a1c4-44fc-af3e-82fc01a334de'::uuid
  ]) AS slot_id
)
DELETE FROM public.payroll_entries pe
USING kim, removed_slots rs
WHERE pe.teacher_id = kim.teacher_id
  AND pe.class_date BETWEEN '2026-05-01' AND '2026-05-31'
  AND pe.schedule_slot_id = rs.slot_id;

UPDATE public.payroll_entries pe
SET minutes = 80, updated_at = now()
FROM (SELECT id AS teacher_id FROM public.teachers WHERE name = '김종현' LIMIT 1) kim
WHERE pe.teacher_id = kim.teacher_id
  AND pe.class_date BETWEEN '2026-05-01' AND '2026-05-31'
  AND pe.schedule_slot_id IN (
    'b1b4f4d7-b2ea-43b5-97ef-98c723e59a22',
    'ab712c35-59c0-446e-9187-42d84cb1231f'
  )
  AND pe.entry_status = 'as_scheduled'
  AND pe.minutes = 85;
