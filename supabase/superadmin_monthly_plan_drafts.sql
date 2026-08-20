-- 슈퍼관리자 개인 월간 계획안 초안
-- 선생님 공통 계획안과 분리된 1단계 전용 구조

CREATE OR REPLACE FUNCTION public.is_monthly_plan_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.id = auth.uid()
      AND t.role = 'superadmin'
  );
$$;

CREATE TABLE IF NOT EXISTS public.monthly_plan_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year_month date NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, year_month),
  CHECK (date_trunc('month', year_month)::date = year_month)
);

CREATE TABLE IF NOT EXISTS public.monthly_plan_draft_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.monthly_plan_drafts(id) ON DELETE CASCADE,
  age_group text NOT NULL CHECK (age_group IN ('3_4', '5', '7')),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  activity_name text NOT NULL DEFAULT '',
  activity_description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, age_group, position)
);

CREATE INDEX IF NOT EXISTS idx_monthly_plan_drafts_owner_month
  ON public.monthly_plan_drafts(owner_id, year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_plan_entries_plan
  ON public.monthly_plan_draft_entries(plan_id, age_group, position);

ALTER TABLE public.monthly_plan_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_plan_draft_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_plan_drafts_superadmin_only" ON public.monthly_plan_drafts;
CREATE POLICY "monthly_plan_drafts_superadmin_only"
  ON public.monthly_plan_drafts
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.is_monthly_plan_superadmin())
  WITH CHECK (owner_id = auth.uid() AND public.is_monthly_plan_superadmin());

DROP POLICY IF EXISTS "monthly_plan_entries_superadmin_only" ON public.monthly_plan_draft_entries;
CREATE POLICY "monthly_plan_entries_superadmin_only"
  ON public.monthly_plan_draft_entries
  FOR ALL TO authenticated
  USING (
    public.is_monthly_plan_superadmin()
    AND EXISTS (
      SELECT 1 FROM public.monthly_plan_drafts p
      WHERE p.id = monthly_plan_draft_entries.plan_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_monthly_plan_superadmin()
    AND EXISTS (
      SELECT 1 FROM public.monthly_plan_drafts p
      WHERE p.id = monthly_plan_draft_entries.plan_id
        AND p.owner_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION public.is_monthly_plan_superadmin() TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_plan_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_plan_draft_entries TO authenticated;
