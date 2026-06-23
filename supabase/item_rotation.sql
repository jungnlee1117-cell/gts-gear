-- 교구 순환 배정 (강사별 월별 알파벳 + 주차별 교구 목록)
-- schedule_payroll_patch_17_item_admin.sql 적용 후 실행 권장

-- 월별 주차 실제 대여 시작일 (전 강사 공통)
CREATE TABLE IF NOT EXISTS public.item_rotation_month_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month date NOT NULL,
  week_number smallint NOT NULL CHECK (week_number BETWEEN 1 AND 5),
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (year_month, week_number)
);

-- 강사별 월별 알파벳 배정 (스냅샷 — 자동 계산 아님)
CREATE TABLE IF NOT EXISTS public.item_rotation_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year_month date NOT NULL,
  assigned_letter text NOT NULL CHECK (assigned_letter ~ '^[A-L]$'),
  created_at timestamptz DEFAULT now(),
  UNIQUE (teacher_id, year_month)
);

-- 알파벳별 주차별 교구 목록 (유치원/어린이집 템플릿)
CREATE TABLE IF NOT EXISTS public.item_weekly_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter text NOT NULL CHECK (letter ~ '^[A-L]$'),
  week_number smallint NOT NULL CHECK (week_number BETWEEN 1 AND 5),
  target_type text NOT NULL CHECK (target_type IN ('유치원', '어린이집')),
  item_name text NOT NULL,
  is_air_product boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (letter, week_number, target_type)
);

CREATE INDEX IF NOT EXISTS idx_rotation_teacher_month
  ON public.item_rotation_schedule(teacher_id, year_month);
CREATE INDEX IF NOT EXISTS idx_rotation_month
  ON public.item_rotation_schedule(year_month, assigned_letter);
CREATE INDEX IF NOT EXISTS idx_weekly_lists_letter
  ON public.item_weekly_lists(letter, week_number);
CREATE INDEX IF NOT EXISTS idx_rotation_month_weeks
  ON public.item_rotation_month_weeks(year_month);

COMMENT ON TABLE public.item_rotation_schedule IS '강사별 월별 알파벳 배정 스냅샷';
COMMENT ON TABLE public.item_weekly_lists IS '알파벳×주차×유형 교구 목록 템플릿';
COMMENT ON TABLE public.item_rotation_month_weeks IS '월별 주차 실제 대여 기간(금~목 등)';

-- RLS
ALTER TABLE public.item_rotation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_weekly_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_rotation_month_weeks ENABLE ROW LEVEL SECURITY;

-- item_rotation_schedule: 본인 이번달·다음달 조회 / 관리자 전체
DROP POLICY IF EXISTS "rotation_schedule_read_own" ON public.item_rotation_schedule;
CREATE POLICY "rotation_schedule_read_own" ON public.item_rotation_schedule
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_item_admin()
  );

DROP POLICY IF EXISTS "rotation_schedule_admin_write" ON public.item_rotation_schedule;
CREATE POLICY "rotation_schedule_admin_write" ON public.item_rotation_schedule
  FOR ALL TO authenticated
  USING (public.is_item_admin())
  WITH CHECK (public.is_item_admin());

-- item_weekly_lists: 전체 강사 읽기 / 관리자 CRUD
DROP POLICY IF EXISTS "weekly_lists_read_all" ON public.item_weekly_lists;
CREATE POLICY "weekly_lists_read_all" ON public.item_weekly_lists
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "weekly_lists_admin_write" ON public.item_weekly_lists;
CREATE POLICY "weekly_lists_admin_write" ON public.item_weekly_lists
  FOR ALL TO authenticated
  USING (public.is_item_admin())
  WITH CHECK (public.is_item_admin());

-- item_rotation_month_weeks
DROP POLICY IF EXISTS "month_weeks_read_all" ON public.item_rotation_month_weeks;
CREATE POLICY "month_weeks_read_all" ON public.item_rotation_month_weeks
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "month_weeks_admin_write" ON public.item_rotation_month_weeks;
CREATE POLICY "month_weeks_admin_write" ON public.item_rotation_month_weeks
  FOR ALL TO authenticated
  USING (public.is_item_admin())
  WITH CHECK (public.is_item_admin());
