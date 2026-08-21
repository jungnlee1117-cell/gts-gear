-- 슈퍼관리자 표시명을 정티쳐로 통일 (키오스크·계정 목록 노출용)
UPDATE public.teachers
SET name = '정티쳐'
WHERE role = 'superadmin'
  AND COALESCE(name, '') IS DISTINCT FROM '정티쳐';
