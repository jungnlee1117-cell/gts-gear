-- 테스트용 더미 강사 비활성화 (삭제 대신 active=false — 대여 기록 등 FK 참조 유지)
-- Supabase SQL Editor에서 실행

UPDATE public.teachers
SET active = false
WHERE name IN ('이엘리', '정현진', '지티에스')
  AND active = true;
