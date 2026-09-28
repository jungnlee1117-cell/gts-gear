-- 관리자 대행 체크: payroll_entries는 담당 원 범위만.
-- 전체 회사 선생님 수업 기록에 열어 두지 않음.
--
-- 슈퍼관리자: 전체
-- 일반 관리자(role=admin, institutions.manager_id = 본인):
--   · 담당 원에 붙은 수업 행 (institution_id)
--   · 담당 원에 배정된 선생님의 가정방문 행 (institution_id IS NULL)
--
-- teacher_pay_rates 는 이 파일에서 잠그지 않음.
-- (원 정산 강사료 재계산이 클라이언트에서 단가를 읽고 있음 — 별도 작업)

DROP POLICY IF EXISTS "payroll_admin_all" ON public.payroll_entries;
CREATE POLICY "payroll_admin_all" ON public.payroll_entries
  FOR ALL TO authenticated
  USING (
    public.is_schedule_superadmin()
    OR (
      public.is_schedule_regional_manager()
      AND (
        (institution_id IS NOT NULL AND public.manages_institution(institution_id))
        OR (
          institution_id IS NULL
          AND public.teacher_at_managed_institution(teacher_id)
        )
      )
    )
  )
  WITH CHECK (
    public.is_schedule_superadmin()
    OR (
      public.is_schedule_regional_manager()
      AND (
        (institution_id IS NOT NULL AND public.manages_institution(institution_id))
        OR (
          institution_id IS NULL
          AND public.teacher_at_managed_institution(teacher_id)
        )
      )
    )
  );

-- 관리자가 대신 남긴 특이사항은 수업 담당 선생님 기록으로 귀속
-- (카테고리 정규화/검증은 class_incident_reports_categories.sql 과 동일)
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
