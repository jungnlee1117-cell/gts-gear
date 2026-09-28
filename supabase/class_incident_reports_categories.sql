-- 수업 특이사항 대분류/세부항목 + 대강·시간변경 구조화 필드
-- 기존 class_incident_reports 행은 category/subtype NULL (레거시 자유 텍스트) 유지
-- RLS 정책은 그대로. 선생님 본인 행 / 관리자 전체.

ALTER TABLE public.class_incident_reports
  ADD COLUMN IF NOT EXISTS incident_category text,
  ADD COLUMN IF NOT EXISTS incident_subtype text,
  ADD COLUMN IF NOT EXISTS substitute_teacher_id uuid
    REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS changed_start_time time,
  ADD COLUMN IF NOT EXISTS changed_end_time time;

COMMENT ON COLUMN public.class_incident_reports.incident_category IS
  '대분류: schedule/safety/institution_request/equipment_facility/other. 레거시는 NULL.';
COMMENT ON COLUMN public.class_incident_reports.incident_subtype IS
  '세부항목. 대분류에 세부가 없으면 NULL.';
COMMENT ON COLUMN public.class_incident_reports.substitute_teacher_id IS
  '대강(schedule/substitute)일 때 대신한 선생님.';
COMMENT ON COLUMN public.class_incident_reports.changed_start_time IS
  '시간변경(schedule/time_change) 새 시작 시간.';
COMMENT ON COLUMN public.class_incident_reports.changed_end_time IS
  '시간변경(schedule/time_change) 새 종료 시간.';
COMMENT ON COLUMN public.class_incident_reports.body IS
  '상세 설명. 구조화 필드만으로 충분한 경우 자동 요약이 들어갈 수 있음.';

ALTER TABLE public.class_incident_reports
  DROP CONSTRAINT IF EXISTS class_incident_reports_category_check;
ALTER TABLE public.class_incident_reports
  ADD CONSTRAINT class_incident_reports_category_check
  CHECK (
    incident_category IS NULL
    OR incident_category IN (
      'schedule',
      'safety',
      'institution_request',
      'equipment_facility',
      'other'
    )
  );

ALTER TABLE public.class_incident_reports
  DROP CONSTRAINT IF EXISTS class_incident_reports_subtype_check;
ALTER TABLE public.class_incident_reports
  ADD CONSTRAINT class_incident_reports_subtype_check
  CHECK (
    incident_subtype IS NULL
    OR incident_subtype IN (
      'substitute',
      'cancelled',
      'time_change',
      'teacher_injured',
      'child_injured',
      'equipment_damaged',
      'equipment_broken',
      'facility_damaged',
      'other'
    )
  );

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
        'equipment_damaged',
        'equipment_broken',
        'facility_damaged',
        'other'
      )
    )
    OR (
      incident_category = 'other'
      AND incident_subtype IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_class_incident_reports_category
  ON public.class_incident_reports (incident_category, status, class_date DESC);

-- 관리자 대행 귀속 + 카테고리 정규화/검증
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
