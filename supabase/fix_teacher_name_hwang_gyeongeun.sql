-- 잘못 등록된 선생님 이름을 바로잡습니다.
-- 정확히 '황경음'인 행만 변경하므로 다른 선생님 데이터에는 영향을 주지 않습니다.

UPDATE public.teachers
SET name = '황경은'
WHERE name = '황경음';
