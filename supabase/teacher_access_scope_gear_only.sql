-- 특정 선생님만 교구 대여/반납/재고로 접근 범위를 제한
-- access_scope 기본값 full — 이 파일만으로는 누구에게도 제한이 걸리지 않음
-- 플래그 적용은 apply_ansoyeon_gear_only.sql 에서 teacher_id로 1명만 UPDATE

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS access_scope text NOT NULL DEFAULT 'full';

ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_access_scope_check;

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_access_scope_check
  CHECK (access_scope = ANY (ARRAY['full'::text, 'gear_only'::text]));

COMMENT ON COLUMN public.teachers.access_scope IS
  'full=기존 권한, gear_only=교구 대여/반납/재고만';

CREATE OR REPLACE FUNCTION public.is_gear_only_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid()
      AND t.access_scope = 'gear_only'
  );
$$;

REVOKE ALL ON FUNCTION public.is_gear_only_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_gear_only_access() TO authenticated;

-- ============================================
-- SECURITY DEFINER RPC — RLS를 우회하므로 함수 내부에서 차단
-- ============================================
CREATE OR REPLACE FUNCTION public.get_teacher_assigned_institutions()
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  parking_info text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.name, i.address, i.parking_info, i.is_active
  FROM public.institutions i
  INNER JOIN public.institution_teacher_assignments a
    ON a.institution_id = i.id
  WHERE a.teacher_id = auth.uid()
    AND a.is_active = true
    AND i.is_active = true
    AND NOT public.is_gear_only_access()
  ORDER BY i.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_assigned_institutions() TO authenticated;

DROP FUNCTION IF EXISTS public.get_teachers_with_email();

CREATE FUNCTION public.get_teachers_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  role text,
  active boolean,
  is_item_admin boolean,
  hire_date date,
  resigned_at date,
  resignation_reason text,
  english_name text,
  contract_type text,
  emergency_contact text,
  qualifications text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    t.id,
    t.name,
    t.phone,
    COALESCE(NULLIF(TRIM(t.email), ''), u.email::text) AS email,
    t.role,
    t.active,
    COALESCE(t.is_item_admin, false) AS is_item_admin,
    t.hire_date,
    t.resigned_at,
    t.resignation_reason,
    t.english_name,
    t.contract_type,
    t.emergency_contact,
    t.qualifications,
    t.created_at
  FROM public.teachers t
  LEFT JOIN auth.users u ON u.id = t.id
  WHERE NOT public.is_gear_only_access()
  ORDER BY t.created_at ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_teachers_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teachers_with_email() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_teacher_documents(p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_teacher_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND NOT public.is_gear_only_access()
    AND (
      p_teacher_id = auth.uid()
      OR public.is_teacher_schedule_admin()
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_teacher_documents(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_institution_documents(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_institution_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND NOT public.is_gear_only_access()
    AND (
      public.is_schedule_admin()
      OR EXISTS (
        SELECT 1
        FROM public.institutions i
        WHERE i.id = p_institution_id
          AND i.manager_id = auth.uid()
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_institution_documents(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_todo_completion(p_todo_id uuid, p_is_completed boolean)
RETURNS admin_todos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo public.admin_todos;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF public.is_gear_only_access() THEN
    RAISE EXCEPTION '이 계정은 할 일에 접근할 수 없습니다.';
  END IF;

  UPDATE public.admin_todos
  SET
    is_completed = coalesce(p_is_completed, false),
    completed_at = CASE
      WHEN coalesce(p_is_completed, false) THEN now()
      ELSE NULL
    END
  WHERE id = p_todo_id
    AND assignee_id = auth.uid()
  RETURNING * INTO v_todo;

  IF v_todo.id IS NULL THEN
    RAISE EXCEPTION '본인에게 배정된 할 일을 찾을 수 없습니다.';
  END IF;

  RETURN v_todo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_todo_completion(uuid, boolean) TO authenticated;

-- ============================================
-- teachers: gear_only 는 본인 행 SELECT만, 프로필 수정/삭제 불가
-- ============================================
DROP POLICY IF EXISTS gear_only_teachers_select ON public.teachers;
CREATE POLICY gear_only_teachers_select ON public.teachers
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.is_gear_only_access() OR id = auth.uid());

DROP POLICY IF EXISTS gear_only_teachers_insert ON public.teachers;
CREATE POLICY gear_only_teachers_insert ON public.teachers
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_gear_only_access());

DROP POLICY IF EXISTS gear_only_teachers_update ON public.teachers;
CREATE POLICY gear_only_teachers_update ON public.teachers
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (NOT public.is_gear_only_access())
  WITH CHECK (NOT public.is_gear_only_access());

DROP POLICY IF EXISTS gear_only_teachers_delete ON public.teachers;
CREATE POLICY gear_only_teachers_delete ON public.teachers
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (NOT public.is_gear_only_access());

-- ============================================
-- 민감/구조 파악용 테이블 — 기존 permissive 정책에 AND 로 차단
-- items / item_sets / rental_* / reservations / gear_categories 는 열어둠
-- ============================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'institution_weekly_schedule',
    'institution_schedule_exceptions',
    'institution_schedule_exception_classes',
    'institution_teacher_assignments',
    'institution_monthly_contracts',
    'institution_session_rates',
    'institution_monthly_session_counts',
    'institution_documents',
    'institutions',
    'home_visit_schedules',
    'home_visit_patterns',
    'oneoff_lessons',
    'substitute_lessons',
    'schedule_change_notifications',
    'temp_teachers',
    'admin_todos',
    'todo_recurrences',
    'resources',
    'resource_folders',
    'pe_categories',
    'monthly_lesson_plans',
    'equipment_name_aliases',
    'monthly_plan_drafts',
    'monthly_plan_entries',
    'lesson_script_admin_data',
    'lesson_script_saved_lessons',
    'gear_script_entries',
    'payroll_entries',
    'teacher_pay_rates',
    'additional_payments',
    'additional_payment_requests',
    'monthly_settlements',
    'teacher_documents',
    'teacher_document_types',
    'teacher_contracts',
    'teacher_contract_rates',
    'teacher_certifications',
    'teacher_careers',
    'teacher_notes',
    'class_incident_reports',
    'class_incident_replies',
    'teacher_settlement_profiles',
    'teacher_settlement_reveal_audit',
    'item_rotation_schedule',
    'item_weekly_lists',
    'item_rotation_month_weeks',
    'item_ideas',
    'item_idea_likes',
    'notices',
    'notice_reads',
    'notice_attachments',
    'giti_usage_events',
    'giti_reports'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND c.relrowsecurity
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS gear_only_deny ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY gear_only_deny ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_gear_only_access()) WITH CHECK (NOT public.is_gear_only_access())',
      t
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
