-- institution_monthly_contracts: 2025-05 → 2026-05 year_month 수정
-- 대상: notes = 'CSV 5월매출(참고) 시드' 이고 year_month = 2025-05-01 인 행만
-- created_at 등 다른 컬럼은 변경하지 않음

-- (1) 수정 전 확인
SELECT id, institution_id, year_month, contract_amount, notes, created_at
FROM public.institution_monthly_contracts
WHERE year_month = '2025-05-01'
  AND notes = 'CSV 5월매출(참고) 시드'
ORDER BY institution_id;

-- (2) 동일 institution_id에 2026-05-01 행이 이미 있으면 UNIQUE 위반 → 먼저 확인
SELECT c25.institution_id, i.name
FROM public.institution_monthly_contracts c25
JOIN public.institution_monthly_contracts c26
  ON c26.institution_id = c25.institution_id
 AND c26.year_month = '2026-05-01'
JOIN public.institutions i ON i.id = c25.institution_id
WHERE c25.year_month = '2025-05-01'
  AND c25.notes = 'CSV 5월매출(참고) 시드';

-- (3) 일괄 수정 (위 (2) 결과가 0건일 때 실행)
BEGIN;

UPDATE public.institution_monthly_contracts
SET year_month = '2026-05-01'
WHERE year_month = '2025-05-01'
  AND notes = 'CSV 5월매출(참고) 시드';

-- 기대: 17 rows
-- SELECT COUNT(*) FROM public.institution_monthly_contracts
-- WHERE year_month = '2026-05-01' AND notes = 'CSV 5월매출(참고) 시드';

COMMIT;
