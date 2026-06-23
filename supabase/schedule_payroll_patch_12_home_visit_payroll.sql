-- payroll_entries ↔ home_visit_patterns 연결 (가정방문 급여 확정용)
-- home_visit_schedules(구) 와 무관 — home_visit_patterns 만 참조
--
-- 선행: home_visit_patterns 테이블 필요
--   → schedule_payroll_patch_11_home_visit_patterns.sql (또는 아래 ensure 블록)
--
-- Supabase SQL Editor에서 이 파일만 실행해도 됨

-- home_visit_patterns 없으면 생성 (patch 11 미적용 DB 대비)
CREATE TABLE IF NOT EXISTS public.home_visit_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_birth_date date,
  parent_contact text,
  location text,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time,
  pattern_start_date date NOT NULL,
  pattern_end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_visit_patterns_end_after_start
    CHECK (pattern_end_date IS NULL OR pattern_end_date >= pattern_start_date)
);

-- payroll_entries 에 FK 컬럼 추가
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS home_visit_pattern_id uuid;

-- 기존 잘못된 FK가 있으면 제거 후 재연결 (home_visit_schedules 등)
DO $$
DECLARE
  c name;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'payroll_entries'
      AND con.contype = 'f'
      AND con.conkey @> ARRAY(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = rel.oid AND attname = 'home_visit_pattern_id'
      )
      AND frel.relname <> 'home_visit_patterns'
  LOOP
    EXECUTE format('ALTER TABLE public.payroll_entries DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_entries_home_visit_pattern_id_fkey'
      AND conrelid = 'public.payroll_entries'::regclass
  ) THEN
    ALTER TABLE public.payroll_entries
      ADD CONSTRAINT payroll_entries_home_visit_pattern_id_fkey
      FOREIGN KEY (home_visit_pattern_id)
      REFERENCES public.home_visit_patterns(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_teacher_date_home_visit
  ON public.payroll_entries (teacher_id, class_date, home_visit_pattern_id)
  WHERE home_visit_pattern_id IS NOT NULL;

COMMENT ON COLUMN public.payroll_entries.home_visit_pattern_id IS
  'home_visit_patterns 패턴과 1:1 매칭 (가정방문 급여 확정)';
