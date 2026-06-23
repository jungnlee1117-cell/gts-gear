-- 어욱진 선생님 주간 스케줄 정리 + 2026-05 payroll_entries 재정렬
-- 1) Sie.K 월·금 14:20~14:35 휴식 슬롯 삭제
-- 2) 송파폴리 방과후 2타임은 40+40분 (15:00~15:40, 15:45~16:25) — 스케줄은 이미 맞음, payroll만 45→40 보정

-- 1) 휴식 슬롯 삭제
DELETE FROM public.institution_weekly_schedule
WHERE id IN (
  'f1cc8ce7-8530-45cd-8153-db8917962f0a',  -- 월 휴식
  'b10d7662-9ab7-41d5-939c-c11e137e4dab'   -- 금 휴식
)
AND teacher_id = (SELECT id FROM public.teachers WHERE name = '어욱진' LIMIT 1);

-- 2) 2026-05 확정 payroll: 휴식 entry 삭제
DELETE FROM public.payroll_entries pe
USING (SELECT id AS teacher_id FROM public.teachers WHERE name = '어욱진' LIMIT 1) t
WHERE pe.teacher_id = t.teacher_id
  AND pe.class_date BETWEEN '2026-05-01' AND '2026-05-31'
  AND pe.schedule_slot_id IN (
    'f1cc8ce7-8530-45cd-8153-db8917962f0a',
    'b10d7662-9ab7-41d5-939c-c11e137e4dab'
  );

-- 3) 송파폴리 방과후 2타임 45분 → 40분 (구 15:40~16:25 잔여)
UPDATE public.payroll_entries pe
SET minutes = 40, updated_at = now()
FROM (SELECT id AS teacher_id FROM public.teachers WHERE name = '어욱진' LIMIT 1) t
WHERE pe.teacher_id = t.teacher_id
  AND pe.class_date BETWEEN '2026-05-01' AND '2026-05-31'
  AND pe.schedule_slot_id IN (
    '4993dee9-6f24-4da6-b65d-24941b3cf2e0',  -- 화 방과후 2타임
    '9a40b700-ff05-4e10-ade2-7bb546116598'   -- 목 방과후 2타임
  )
  AND pe.entry_status = 'as_scheduled'
  AND pe.minutes = 45;
