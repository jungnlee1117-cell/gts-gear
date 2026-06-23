-- 교구명 중복 방지 (trim + lower case-insensitive unique)
-- 1) 아래 SELECT로 기존 중복 확인 후, 2) 중복 없을 때만 인덱스 생성

-- === 중복 확인 (실행 결과가 있으면 먼저 데이터 정리) ===
SELECT
  lower(trim(name)) AS normalized_name,
  count(*) AS cnt,
  array_agg(name ORDER BY name) AS names,
  array_agg(code ORDER BY code) AS codes
FROM public.items
WHERE trim(name) <> ''
GROUP BY lower(trim(name))
HAVING count(*) > 1
ORDER BY cnt DESC, normalized_name;

-- === 중복 없을 때만 실행 ===
CREATE UNIQUE INDEX IF NOT EXISTS items_name_normalized_unique
  ON public.items (lower(trim(name)));

COMMENT ON INDEX public.items_name_normalized_unique IS
  '교구명 중복 방지 (공백 trim + 대소문자 무시)';
