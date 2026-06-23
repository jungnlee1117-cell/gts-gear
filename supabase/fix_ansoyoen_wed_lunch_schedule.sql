-- 안소연 선생님 리비어어학원 수요일 점심시간(11:10~12:40) 정규 슬롯 제거
-- 시트 점심 시간 행: 11:10 ~ 12:40 (수업 30분×6타임, 점심은 비수업)
-- Supabase SQL Editor에서 실행 (idempotent)

-- 1) 점심 구간을 정규수업으로 잘못 등록한 슬롯 삭제
DELETE FROM public.institution_weekly_schedule
WHERE id = '7822ed18-efb8-43f5-8736-c22c085995b5'
AND teacher_id = (SELECT id FROM public.teachers WHERE name = '안소연' LIMIT 1);

-- 2) 해당 슬롯에 연결된 확정 payroll_entries 삭제 (5월 수요일 4건 × 90분)
DELETE FROM public.payroll_entries pe
USING (SELECT id AS teacher_id FROM public.teachers WHERE name = '안소연' LIMIT 1) t
WHERE pe.teacher_id = t.teacher_id
  AND pe.class_date >= '2026-05-01'
  AND pe.class_date < '2026-07-01'
  AND pe.schedule_slot_id = '7822ed18-efb8-43f5-8736-c22c085995b5';
