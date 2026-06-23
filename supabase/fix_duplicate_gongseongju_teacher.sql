-- 공성주 중복 계정 정리
-- 실제 사용: 06ee3d8d (nina6779@naver.com) — 스케줄·단가·배정 있음
-- 삭제 대상: b2a46b23 (sungju.gong@gmail.com) — 데이터 없음, 미로그인
-- auth.users 삭제는 Supabase Dashboard 또는 scripts/remove-duplicate-gongseongju.mjs 사용

DELETE FROM public.teachers
WHERE id = 'b2a46b23-c4d6-4045-ad31-8b4e0998c55f'
  AND name = '공성주'
  AND NOT EXISTS (SELECT 1 FROM public.institution_weekly_schedule WHERE teacher_id = 'b2a46b23-c4d6-4045-ad31-8b4e0998c55f')
  AND NOT EXISTS (SELECT 1 FROM public.teacher_pay_rates WHERE teacher_id = 'b2a46b23-c4d6-4045-ad31-8b4e0998c55f')
  AND NOT EXISTS (SELECT 1 FROM public.institution_teacher_assignments WHERE teacher_id = 'b2a46b23-c4d6-4045-ad31-8b4e0998c55f');
