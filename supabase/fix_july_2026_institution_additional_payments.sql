-- 2026-07 기관별 추가금 보정
-- 윤한경: 합산 '추가수당' 100,000 → 프랜시스파커 5만 + 관악SLP 5만
-- 김종현 수지폴리 본관 10만 = 기존 '교통비지원' 행 (별도 '추가금액' 두지 않음)

DO $$
DECLARE
  admin_id uuid;
  yoon_id uuid;
  seed_month date := '2026-07-01'::date;
BEGIN
  SELECT id INTO admin_id
  FROM public.teachers
  WHERE role = 'superadmin'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO yoon_id FROM public.teachers WHERE name = '윤한경' LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE '슈퍼관리자 없음 — 스킵';
    RETURN;
  END IF;

  -- 김종현: 잘못 시드된 '추가금액' 제거 (교통비지원이 수지폴리 귀속분)
  DELETE FROM public.additional_payments ap
  USING public.teachers t
  WHERE ap.teacher_id = t.id
    AND t.name = '김종현'
    AND ap.year_month = seed_month
    AND ap.reason = '추가금액';

  -- 윤한경: 합산 '추가수당' 제거 (분리 등록으로 대체)
  DELETE FROM public.additional_payments ap
  WHERE ap.teacher_id = yoon_id
    AND ap.year_month = seed_month
    AND ap.reason = '추가수당';

  -- 윤한경 · 프랜시스파커 5만
  INSERT INTO public.additional_payments (teacher_id, year_month, amount, reason, created_by)
  SELECT yoon_id, seed_month, 50000, '프랜시스파커 추가수당', admin_id
  WHERE yoon_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.additional_payments ap
      WHERE ap.teacher_id = yoon_id
        AND ap.year_month = seed_month
        AND ap.reason = '프랜시스파커 추가수당'
    );

  -- 윤한경 · 관악SLP 5만
  INSERT INTO public.additional_payments (teacher_id, year_month, amount, reason, created_by)
  SELECT yoon_id, seed_month, 50000, '관악SLP 추가수당', admin_id
  WHERE yoon_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.additional_payments ap
      WHERE ap.teacher_id = yoon_id
        AND ap.year_month = seed_month
        AND ap.reason = '관악SLP 추가수당'
    );
END $$;
