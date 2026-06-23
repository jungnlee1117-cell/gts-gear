-- 김종현 선생님 teacher_pay_rates 정리
-- Supabase SQL Editor에서 실행

-- 1) 잘못 입력된 단가 삭제
DELETE FROM public.teacher_pay_rates tpr
USING public.teachers t
WHERE tpr.teacher_id = t.id
  AND t.name = '김종현'
  AND ROUND(tpr.rate_per_minute::numeric, 2) IN (7166.67, 43000.00);

-- 2) 716.67 정규·방과후 외 나머지 행 삭제
DELETE FROM public.teacher_pay_rates tpr
USING public.teachers t
WHERE tpr.teacher_id = t.id
  AND t.name = '김종현'
  AND NOT (
    ROUND(tpr.rate_per_minute::numeric, 2) = 716.67
    AND tpr.pay_type IN ('정규', '방과후')
  );

-- 3) 유형별 중복 716.67 행 — 최신 1건만 남기고 삭제
DELETE FROM public.teacher_pay_rates
WHERE id IN (
  SELECT tpr.id
  FROM public.teacher_pay_rates tpr
  JOIN public.teachers t ON t.id = tpr.teacher_id
  WHERE t.name = '김종현'
    AND ROUND(tpr.rate_per_minute::numeric, 2) = 716.67
    AND tpr.pay_type IN ('정규', '방과후')
    AND tpr.id NOT IN (
      SELECT DISTINCT ON (tpr2.pay_type) tpr2.id
      FROM public.teacher_pay_rates tpr2
      JOIN public.teachers t2 ON t2.id = tpr2.teacher_id
      WHERE t2.name = '김종현'
        AND ROUND(tpr2.rate_per_minute::numeric, 2) = 716.67
        AND tpr2.pay_type IN ('정규', '방과후')
      ORDER BY tpr2.pay_type, tpr2.effective_from DESC, tpr2.created_at DESC
    )
);

-- 4) 남은 두 행 적용 시작일 수정
UPDATE public.teacher_pay_rates tpr
SET effective_from = '2026-03-01'
FROM public.teachers t
WHERE tpr.teacher_id = t.id
  AND t.name = '김종현'
  AND ROUND(tpr.rate_per_minute::numeric, 2) = 716.67
  AND tpr.pay_type IN ('정규', '방과후');
