-- 공성주 계정 이메일 통합: nina6779@naver.com → sungju.gong@gmail.com
-- auth.users 변경은 Supabase Admin API 필요 (Dashboard 또는 scripts/update-gongseongju-email.mjs)
-- 중복 b2a46b23 (gmail) 계정은 fix_duplicate_gongseongju_teacher.sql 로 이미 삭제됨

UPDATE public.teachers
SET email = 'sungju.gong@gmail.com'
WHERE id = '06ee3d8d-cc98-4d2e-a000-7d94c34f27ae'
  AND name = '공성주';
