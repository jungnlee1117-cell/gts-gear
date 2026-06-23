-- 김종현 선생님 주간 스케줄 정리 + 2026-06-01~18 payroll_entries 재정렬
-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전하도록 idempotent 구성)

-- 1) 방과후 85분 → 80분 (15:00~16:20)
UPDATE public.institution_weekly_schedule
SET end_time = '16:20:00', updated_at = now()
WHERE id IN (
  'b1b4f4d7-b2ea-43b5-97ef-98c723e59a22',  -- 월 방과후
  'ab712c35-59c0-446e-9187-42d84cb1231f'   -- 목 방과후
)
AND teacher_id = (SELECT id FROM public.teachers WHERE name = '김종현' LIMIT 1);

-- 2) 점심 슬롯 삭제 (12:00~12:40, 정규 아님)
DELETE FROM public.institution_weekly_schedule
WHERE id IN (
  'bde10002-016b-4f8f-bd2c-771e46aa9aa9',  -- 월
  'daa6e376-9113-4daf-8260-2e2d1c9d97b1',  -- 화
  '2f9ff774-43b5-426c-a893-313e07878e08'   -- 목
)
AND teacher_id = (SELECT id FROM public.teachers WHERE name = '김종현' LIMIT 1);

-- 3) 화요일 방과후 슬롯 삭제
DELETE FROM public.institution_weekly_schedule
WHERE id = '0cede120-a1c4-44fc-af3e-82fc01a334de'
AND teacher_id = (SELECT id FROM public.teachers WHERE name = '김종현' LIMIT 1);

-- 4) 6/1~6/18 확정 payroll_entries 재정렬
--    (삭제된 슬롯에 연결된 entry 제거, 남은 방과후 85→80)
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
  AND pe.class_date BETWEEN '2026-06-01' AND '2026-06-18'
  AND pe.schedule_slot_id = rs.slot_id;

UPDATE public.payroll_entries pe
SET minutes = 80, updated_at = now()
FROM (SELECT id AS teacher_id FROM public.teachers WHERE name = '김종현' LIMIT 1) kim
WHERE pe.teacher_id = kim.teacher_id
  AND pe.class_date BETWEEN '2026-06-01' AND '2026-06-18'
  AND pe.schedule_slot_id IN (
    'b1b4f4d7-b2ea-43b5-97ef-98c723e59a22',
    'ab712c35-59c0-446e-9187-42d84cb1231f'
  )
  AND pe.entry_status = 'as_scheduled'
  AND pe.minutes = 85;

-- 5) 정규 3타임 45분 → 40분 (11:15~12:00 → 11:20~12:00, 수요일과 동일)
UPDATE public.institution_weekly_schedule
SET start_time = '11:20:00', updated_at = now()
WHERE id IN (
  'afca1542-ba3b-4d41-b717-b705b0da696d',  -- 월
  '62c49d07-65a1-40e2-8d92-b08390159536',  -- 화
  'a5afe3c9-ed9c-48ad-a561-18999843c1b3'   -- 목
)
AND teacher_id = (SELECT id FROM public.teachers WHERE name = '김종현' LIMIT 1);

UPDATE public.payroll_entries pe
SET minutes = 40, updated_at = now()
FROM (SELECT id AS teacher_id FROM public.teachers WHERE name = '김종현' LIMIT 1) kim
WHERE pe.teacher_id = kim.teacher_id
  AND pe.class_date BETWEEN '2026-06-01' AND '2026-06-18'
  AND pe.schedule_slot_id IN (
    'afca1542-ba3b-4d41-b717-b705b0da696d',
    '62c49d07-65a1-40e2-8d92-b08390159536',
    'a5afe3c9-ed9c-48ad-a561-18999843c1b3'
  )
  AND pe.entry_status = 'as_scheduled'
  AND pe.minutes = 45;
