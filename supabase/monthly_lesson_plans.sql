-- 영어체육 월간 계획안 + 영문/한글 교구명 매핑
-- schedule_payroll_patch_17_item_admin.sql 적용 후 실행 권장

CREATE TABLE IF NOT EXISTS public.equipment_name_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_name_en text NOT NULL,
  item_name_ko text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (equipment_name_en)
);

CREATE TABLE IF NOT EXISTS public.monthly_lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month date NOT NULL,
  week_number smallint NOT NULL CHECK (week_number BETWEEN 1 AND 5),
  equipment_name_en text NOT NULL,
  activity_description text NOT NULL DEFAULT '',
  key_expressions text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (year_month, week_number)
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_month
  ON public.monthly_lesson_plans(year_month, week_number);
CREATE INDEX IF NOT EXISTS idx_equipment_aliases_en
  ON public.equipment_name_aliases(equipment_name_en);
CREATE INDEX IF NOT EXISTS idx_equipment_aliases_ko
  ON public.equipment_name_aliases(item_name_ko);

COMMENT ON TABLE public.monthly_lesson_plans IS '영어체육 월간 계획안 (주차별)';
COMMENT ON TABLE public.equipment_name_aliases IS '영문 교구명 ↔ 순환표 한글 교구명';

ALTER TABLE public.monthly_lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_name_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_plans_read_all" ON public.monthly_lesson_plans;
CREATE POLICY "lesson_plans_read_all" ON public.monthly_lesson_plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lesson_plans_admin_write" ON public.monthly_lesson_plans;
CREATE POLICY "lesson_plans_admin_write" ON public.monthly_lesson_plans
  FOR ALL TO authenticated
  USING (public.is_item_admin())
  WITH CHECK (public.is_item_admin());

DROP POLICY IF EXISTS "equipment_aliases_read_all" ON public.equipment_name_aliases;
CREATE POLICY "equipment_aliases_read_all" ON public.equipment_name_aliases
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "equipment_aliases_admin_write" ON public.equipment_name_aliases;
CREATE POLICY "equipment_aliases_admin_write" ON public.equipment_name_aliases
  FOR ALL TO authenticated
  USING (public.is_item_admin())
  WITH CHECK (public.is_item_admin());
