-- 수업 특이사항 보고 + 관리자 답장 + 허브 고정카드(audience_type=schedule_admins)
-- 공지 행은 만들지 않음 (재고 변경 이력과 동일)
-- Supabase SQL Editor에서 실행

-- ─────────────────────────────────────────────
-- 1) 보고 본문
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id uuid NOT NULL UNIQUE
    REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL
    REFERENCES public.teachers(id) ON DELETE CASCADE,
  institution_id uuid
    REFERENCES public.institutions(id) ON DELETE SET NULL,
  class_date date NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) > 0),
  incident_category text
    CHECK (incident_category IS NULL OR incident_category IN (
      'schedule', 'safety', 'institution_request', 'equipment_facility', 'other'
    )),
  incident_subtype text
    CHECK (incident_subtype IS NULL OR incident_subtype IN (
      'substitute', 'cancelled', 'time_change',
      'teacher_injured', 'child_injured',
      'equipment_damaged', 'equipment_broken', 'facility_damaged', 'other'
    )),
  substitute_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  changed_start_time time,
  changed_end_time time,
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'reviewed')),
  reviewed_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.class_incident_reports IS
  '수업(payroll_entries) 단위 특이사항 보고. 내용이 있을 때만 행이 생김.';
COMMENT ON COLUMN public.class_incident_reports.status IS
  'needs_review=확인 필요, reviewed=확인 완료. 선생님이 본문·카테고리를 수정하면 다시 needs_review.';
COMMENT ON COLUMN public.class_incident_reports.incident_category IS
  '대분류: schedule/safety/institution_request/equipment_facility/other. 레거시는 NULL.';
COMMENT ON COLUMN public.class_incident_reports.body IS
  '상세 설명. 구조화 필드만으로 충분한 경우 자동 요약이 들어갈 수 있음.';

CREATE INDEX IF NOT EXISTS idx_class_incident_reports_status
  ON public.class_incident_reports (status, class_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_incident_reports_teacher_date
  ON public.class_incident_reports (teacher_id, class_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_incident_reports_institution_date
  ON public.class_incident_reports (institution_id, class_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_incident_reports_class_date
  ON public.class_incident_reports (class_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_incident_reports_category
  ON public.class_incident_reports (incident_category, status, class_date DESC);

ALTER TABLE public.class_incident_reports
  DROP CONSTRAINT IF EXISTS class_incident_reports_category_pair_check;
ALTER TABLE public.class_incident_reports
  ADD CONSTRAINT class_incident_reports_category_pair_check
  CHECK (
    incident_category IS NULL
    OR (
      incident_category = 'schedule'
      AND incident_subtype IN ('substitute', 'cancelled', 'time_change')
    )
    OR (
      incident_category = 'safety'
      AND incident_subtype IN ('teacher_injured', 'child_injured')
    )
    OR (
      incident_category = 'institution_request'
      AND incident_subtype IS NULL
    )
    OR (
      incident_category = 'equipment_facility'
      AND incident_subtype IN (
        'equipment_damaged', 'equipment_broken', 'facility_damaged', 'other'
      )
    )
    OR (
      incident_category = 'other'
      AND incident_subtype IS NULL
    )
  );

-- ─────────────────────────────────────────────
-- 2) 답장 스레드 (관리자·선생님 모두)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_incident_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL
    REFERENCES public.class_incident_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL
    REFERENCES public.teachers(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.class_incident_replies IS
  '수업 특이사항에 대한 답장. author_id 가 관리자·선생님 모두 가능.';

CREATE INDEX IF NOT EXISTS idx_class_incident_replies_report
  ON public.class_incident_replies (report_id, created_at);

-- ─────────────────────────────────────────────
-- 3) 트리거: 본문 trim, 선생님 수정 시 다시 확인 필요
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.class_incident_reports_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.payroll_entries%ROWTYPE;
  v_content_changed boolean := false;
BEGIN
  NEW.body := btrim(COALESCE(NEW.body, ''));
  NEW.incident_category := nullif(btrim(COALESCE(NEW.incident_category, '')), '');
  NEW.incident_subtype := nullif(btrim(COALESCE(NEW.incident_subtype, '')), '');

  IF NEW.incident_subtype IS DISTINCT FROM 'substitute' THEN
    NEW.substitute_teacher_id := NULL;
  END IF;
  IF NEW.incident_subtype IS DISTINCT FROM 'time_change' THEN
    NEW.changed_start_time := NULL;
    NEW.changed_end_time := NULL;
  END IF;

  IF NEW.incident_subtype = 'substitute' AND NEW.substitute_teacher_id IS NULL THEN
    RAISE EXCEPTION '대신한 선생님을 선택해주세요.';
  END IF;
  IF NEW.incident_subtype = 'time_change'
     AND (NEW.changed_start_time IS NULL OR NEW.changed_end_time IS NULL) THEN
    RAISE EXCEPTION '변경된 시작·종료 시간을 입력해주세요.';
  END IF;

  IF NEW.body = '' THEN
    IF NEW.incident_category = 'schedule' AND NEW.incident_subtype = 'substitute' THEN
      NEW.body := '대강';
    ELSIF NEW.incident_category = 'schedule' AND NEW.incident_subtype = 'time_change' THEN
      NEW.body := '시간변경';
    ELSIF NEW.incident_category = 'equipment_facility' THEN
      NEW.body := CASE NEW.incident_subtype
        WHEN 'equipment_damaged' THEN '교구 파손'
        WHEN 'equipment_broken' THEN '교구 고장'
        WHEN 'facility_damaged' THEN '시설 파손'
        ELSE '교구/시설 문제'
      END;
    ELSE
      RAISE EXCEPTION '특이사항 내용을 입력해주세요.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_entry
    FROM public.payroll_entries
    WHERE id = NEW.payroll_entry_id;

    IF v_entry.id IS NULL THEN
      RAISE EXCEPTION '수업 기록을 찾을 수 없습니다.';
    END IF;

    IF NEW.class_date IS NULL THEN
      NEW.class_date := v_entry.class_date;
    END IF;
    IF NEW.institution_id IS NULL THEN
      NEW.institution_id := v_entry.institution_id;
    END IF;

    IF public.is_schedule_admin() THEN
      NEW.teacher_id := COALESCE(v_entry.teacher_id, NEW.teacher_id, auth.uid());
    ELSE
      IF NEW.teacher_id IS NULL THEN
        NEW.teacher_id := auth.uid();
      END IF;
      IF NEW.teacher_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION '본인 보고만 작성할 수 있습니다.';
      END IF;
      IF v_entry.teacher_id IS DISTINCT FROM auth.uid()
         AND v_entry.substitute_teacher_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION '본인이 진행한 수업에만 특이사항을 남길 수 있습니다.';
      END IF;
      NEW.status := 'needs_review';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.payroll_entry_id := OLD.payroll_entry_id;
    NEW.teacher_id := OLD.teacher_id;
    NEW.class_date := OLD.class_date;
    IF NEW.institution_id IS NULL THEN
      NEW.institution_id := OLD.institution_id;
    END IF;

    v_content_changed :=
      NEW.body IS DISTINCT FROM OLD.body
      OR NEW.incident_category IS DISTINCT FROM OLD.incident_category
      OR NEW.incident_subtype IS DISTINCT FROM OLD.incident_subtype
      OR NEW.substitute_teacher_id IS DISTINCT FROM OLD.substitute_teacher_id
      OR NEW.changed_start_time IS DISTINCT FROM OLD.changed_start_time
      OR NEW.changed_end_time IS DISTINCT FROM OLD.changed_end_time;

    IF NOT public.is_schedule_admin() THEN
      IF v_content_changed THEN
        NEW.status := 'needs_review';
        NEW.reviewed_by := NULL;
        NEW.reviewed_at := NULL;
      ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'reviewed' THEN
        -- 선생님은 확인 완료로 바꿀 수 없음
        NEW.status := OLD.status;
        NEW.reviewed_by := OLD.reviewed_by;
        NEW.reviewed_at := OLD.reviewed_at;
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'reviewed' THEN
    IF NEW.reviewed_by IS NULL THEN
      NEW.reviewed_by := auth.uid();
    END IF;
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := now();
    END IF;
  ELSIF NEW.status = 'needs_review' THEN
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_incident_reports_before_write
  ON public.class_incident_reports;
CREATE TRIGGER trg_class_incident_reports_before_write
  BEFORE INSERT OR UPDATE ON public.class_incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.class_incident_reports_before_write();

CREATE OR REPLACE FUNCTION public.class_incident_replies_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
BEGIN
  SELECT teacher_id INTO v_teacher
  FROM public.class_incident_reports
  WHERE id = NEW.report_id;

  -- 선생님이 답장하면 관리자가 다시 보도록 확인 필요로 되돌림
  IF v_teacher IS NOT NULL AND NEW.author_id = v_teacher THEN
    UPDATE public.class_incident_reports
    SET status = 'needs_review',
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = now()
    WHERE id = NEW.report_id
      AND status IS DISTINCT FROM 'needs_review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_incident_replies_after_insert
  ON public.class_incident_replies;
CREATE TRIGGER trg_class_incident_replies_after_insert
  AFTER INSERT ON public.class_incident_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.class_incident_replies_after_insert();

CREATE OR REPLACE FUNCTION public.class_incident_replies_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.body := btrim(COALESCE(NEW.body, ''));
  IF NEW.body = '' THEN
    RAISE EXCEPTION '답장 내용을 입력해주세요.';
  END IF;
  IF NEW.author_id IS NULL THEN
    NEW.author_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_incident_replies_before_insert
  ON public.class_incident_replies;
CREATE TRIGGER trg_class_incident_replies_before_insert
  BEFORE INSERT ON public.class_incident_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.class_incident_replies_before_insert();

-- ─────────────────────────────────────────────
-- 4) RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.class_incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_incident_replies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.class_incident_reports FROM PUBLIC;
REVOKE ALL ON public.class_incident_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_incident_reports TO authenticated;
GRANT ALL ON public.class_incident_reports TO service_role;

REVOKE ALL ON public.class_incident_replies FROM PUBLIC;
REVOKE ALL ON public.class_incident_replies FROM anon;
GRANT SELECT, INSERT ON public.class_incident_replies TO authenticated;
GRANT ALL ON public.class_incident_replies TO service_role;

DROP POLICY IF EXISTS "class_incident_reports_admin_all" ON public.class_incident_reports;
CREATE POLICY "class_incident_reports_admin_all" ON public.class_incident_reports
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "class_incident_reports_teacher_select" ON public.class_incident_reports;
CREATE POLICY "class_incident_reports_teacher_select" ON public.class_incident_reports
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "class_incident_reports_teacher_insert" ON public.class_incident_reports;
CREATE POLICY "class_incident_reports_teacher_insert" ON public.class_incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "class_incident_reports_teacher_update" ON public.class_incident_reports;
CREATE POLICY "class_incident_reports_teacher_update" ON public.class_incident_reports
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "class_incident_reports_teacher_delete" ON public.class_incident_reports;
CREATE POLICY "class_incident_reports_teacher_delete" ON public.class_incident_reports
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "class_incident_replies_admin_all" ON public.class_incident_replies;
CREATE POLICY "class_incident_replies_admin_all" ON public.class_incident_replies
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "class_incident_replies_teacher_select" ON public.class_incident_replies;
CREATE POLICY "class_incident_replies_teacher_select" ON public.class_incident_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_incident_reports r
      WHERE r.id = class_incident_replies.report_id
        AND r.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "class_incident_replies_teacher_insert" ON public.class_incident_replies;
CREATE POLICY "class_incident_replies_teacher_insert" ON public.class_incident_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.class_incident_reports r
      WHERE r.id = report_id
        AND r.teacher_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 5) notices.audience_type = schedule_admins
--    (공지 행 INSERT 없음. 허브 고정카드 권한 표시용)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.notices') IS NULL THEN
    RAISE NOTICE 'public.notices 없음 — audience_type 패치 스킵';
    RETURN;
  END IF;

  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.notices'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%audience_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notices DROP CONSTRAINT %I', r.conname);
  END LOOP;

  ALTER TABLE public.notices
    ADD CONSTRAINT notices_audience_type_check
    CHECK (audience_type IN (
      'all',
      'teachers',
      'institution_teachers',
      'specific',
      'item_admins',
      'schedule_admins'
    ));

  COMMENT ON COLUMN public.notices.audience_type IS
    'all=전체, teachers=선생님만, institution_teachers=특정 기관 선생님, specific=지정 선생님, item_admins=교구관리자, schedule_admins=스케줄 관리자(admin+superadmin)';

  DROP POLICY IF EXISTS "notices_select" ON public.notices;
  CREATE POLICY "notices_select" ON public.notices
    FOR SELECT TO authenticated
    USING (
      (
        audience_type = 'item_admins'
        AND public.is_item_admin()
      )
      OR (
        audience_type = 'schedule_admins'
        AND public.is_schedule_admin()
      )
      OR (
        audience_type IS DISTINCT FROM 'item_admins'
        AND audience_type IS DISTINCT FROM 'schedule_admins'
        AND (
          public.is_schedule_superadmin()
          OR author_id = auth.uid()
          OR audience_type = 'all'
          OR (
            audience_type = 'teachers'
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.id = auth.uid()
                AND t.role = 'teacher'
            )
          )
          OR (
            audience_type = 'institution_teachers'
            AND institution_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.id = auth.uid()
                AND t.role = 'teacher'
            )
            AND (
              EXISTS (
                SELECT 1
                FROM public.institution_teacher_assignments a
                WHERE a.institution_id = notices.institution_id
                  AND a.teacher_id = auth.uid()
                  AND a.is_active = true
              )
              OR EXISTS (
                SELECT 1
                FROM public.institution_weekly_schedule w
                WHERE w.institution_id = notices.institution_id
                  AND w.teacher_id = auth.uid()
              )
            )
          )
          OR (
            audience_type = 'specific'
            AND auth.uid() = ANY (audience_teacher_ids)
          )
        )
      )
    );
END $$;
