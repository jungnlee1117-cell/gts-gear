-- payroll_entries: 같은 날짜·같은 스케줄 슬롯은 전역 1건만 허용
-- (대체수업이 원강사/대체강사 양쪽 행을 만들며 이중 집계되던 문제 방지)

-- 슬롯당 중복이 있으면 더 적절한 1건만 남김
-- 우선순위: substitute_teacher_id 있는 행 > minutes 큰 행 > 최신 updated_at
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY class_date, schedule_slot_id
      ORDER BY
        (substitute_teacher_id IS NOT NULL) DESC,
        minutes DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS rn
  FROM public.payroll_entries
  WHERE schedule_slot_id IS NOT NULL
)
DELETE FROM public.payroll_entries pe
USING ranked r
WHERE pe.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS public.idx_payroll_teacher_date_slot;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_date_slot_unique
  ON public.payroll_entries (class_date, schedule_slot_id)
  WHERE schedule_slot_id IS NOT NULL;

COMMENT ON INDEX public.idx_payroll_date_slot_unique IS
  '스케줄 슬롯은 날짜당 1건 — 대체는 substitute_teacher_id로 급여 귀속';
