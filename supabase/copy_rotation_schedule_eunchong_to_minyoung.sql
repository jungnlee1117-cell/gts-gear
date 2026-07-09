-- 교구 순환 배정 복사: 서은총 → 이민영
-- Supabase SQL Editor에서 순서대로 실행하세요.
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │ 교구 배정 관련 테이블                                        │
-- ├──────────────────────────┬──────────────────────────────────┤
-- │ item_rotation_schedule   │ ★ 강사별 월별 알파벳 배정 (복사 대상) │
-- │ item_weekly_lists        │ 알파벳×주차×유형 교구 목록 (공통 템플릿) │
-- │ item_rotation_month_weeks│ 월별 주차 대여 기간 (전 강사 공통)     │
-- └──────────────────────────┴──────────────────────────────────┘
--
-- 강사마다 다른 데이터는 item_rotation_schedule 뿐입니다.
-- assigned_letter(A~L) + year_month 조합으로 「이번달 내 교구」가 결정됩니다.

-- ── 1) 선생님 ID 확인 (실행 후 이름·ID가 맞는지 꼭 확인) ──
SELECT id, name, email, active, role
FROM public.teachers
WHERE name IN ('서은총', '이민영')
   OR name LIKE '%은총%'
   OR name LIKE '%이민영%'
ORDER BY name;

-- ── 2) 복사 전: 서은총 배정 현황 ──
SELECT
  t.name AS teacher_name,
  s.year_month,
  s.assigned_letter,
  s.created_at
FROM public.item_rotation_schedule s
JOIN public.teachers t ON t.id = s.teacher_id
WHERE t.name = '서은총'   -- ← 이름이 다르면 1) 결과에 맞게 수정
ORDER BY s.year_month;

-- ── 3) 복사 전: 이민영 기존 배정 (있으면 덮어씀) ──
SELECT
  t.name AS teacher_name,
  s.year_month,
  s.assigned_letter,
  s.created_at
FROM public.item_rotation_schedule s
JOIN public.teachers t ON t.id = s.teacher_id
WHERE t.name = '이민영'   -- ← 이름이 다르면 1) 결과에 맞게 수정
ORDER BY s.year_month;

-- ── 4) 복사 실행 ──
DO $$
DECLARE
  v_source_id uuid;
  v_target_id uuid;
  v_deleted   int;
  v_inserted  int;
BEGIN
  SELECT id INTO v_source_id
  FROM public.teachers
  WHERE name = '서은총' AND active = true
  LIMIT 1;

  SELECT id INTO v_target_id
  FROM public.teachers
  WHERE name = '이민영' AND active = true
  LIMIT 1;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION '원본 강사 「서은총」을 찾을 수 없습니다. 1) 쿼리로 이름을 확인하세요.';
  END IF;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION '대상 강사 「이민영」을 찾을 수 없습니다. teachers 테이블에 계정이 있는지 확인하세요.';
  END IF;

  IF v_source_id = v_target_id THEN
    RAISE EXCEPTION '원본과 대상이 같은 계정입니다.';
  END IF;

  -- 대상 강사 기존 배정 제거 (서은총과 완전히 동일하게 맞추기)
  DELETE FROM public.item_rotation_schedule
  WHERE teacher_id = v_target_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- 서은총 배정을 이민영에게 복사
  INSERT INTO public.item_rotation_schedule (teacher_id, year_month, assigned_letter)
  SELECT v_target_id, year_month, assigned_letter
  FROM public.item_rotation_schedule
  WHERE teacher_id = v_source_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE '완료: 이민영 기존 %건 삭제 → 서은총 배정 %건 복사', v_deleted, v_inserted;

  IF v_inserted = 0 THEN
    RAISE WARNING '서은총에게 등록된 item_rotation_schedule 데이터가 없습니다.';
  END IF;
END $$;

-- ── 5) 복사 후 검증: 두 강사 배정이 동일한지 비교 ──
WITH
  src AS (
    SELECT year_month, assigned_letter
    FROM public.item_rotation_schedule s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.name = '서은총'
  ),
  tgt AS (
    SELECT year_month, assigned_letter
    FROM public.item_rotation_schedule s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.name = '이민영'
  )
SELECT
  COALESCE(s.year_month, t.year_month) AS year_month,
  s.assigned_letter AS eunchong_letter,
  t.assigned_letter AS minyoung_letter,
  CASE
    WHEN s.assigned_letter IS NULL THEN '이민영만 있음'
    WHEN t.assigned_letter IS NULL THEN '서은총만 있음'
    WHEN s.assigned_letter = t.assigned_letter THEN 'OK'
    ELSE '불일치'
  END AS status
FROM src s
FULL OUTER JOIN tgt t ON s.year_month = t.year_month
ORDER BY 1;

-- ── 6) 월별 나란히 확인 (읽기 쉬운 형태) ──
SELECT
  s.year_month,
  s.assigned_letter AS "서은총",
  t.assigned_letter AS "이민영"
FROM public.item_rotation_schedule s
JOIN public.teachers ts ON ts.id = s.teacher_id AND ts.name = '서은총'
JOIN public.item_rotation_schedule t
  ON t.year_month = s.year_month
JOIN public.teachers tt ON tt.id = t.teacher_id AND tt.name = '이민영'
ORDER BY s.year_month;
