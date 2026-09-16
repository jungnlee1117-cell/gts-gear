-- 행사 일정: 날짜별 수업 선택 휴강
-- schedule_exception_partial_closures.sql 적용 후 실행

-- 슈퍼관리자는 모든 원, 지역 관리자는 institutions.manager_id로 지정된 원만 관리
CREATE OR REPLACE FUNCTION public.manages_institution(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = auth.uid()
        AND t.role = 'superadmin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.institutions i
      WHERE i.id = p_institution_id
        AND i.manager_id = auth.uid()
    );
$fn$;

REVOKE ALL ON FUNCTION public.manages_institution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manages_institution(uuid) TO authenticated;

ALTER TABLE public.institution_schedule_exceptions
  DROP CONSTRAINT IF EXISTS institution_schedule_exceptions_exception_type_check;

ALTER TABLE public.institution_schedule_exceptions
  ADD CONSTRAINT institution_schedule_exceptions_exception_type_check
  CHECK (
    exception_type IN (
      'cancelled',
      'class_cancelled',
      'cancelled_am',
      'cancelled_pm',
      'event',
      'time_change'
    )
  );

CREATE TABLE IF NOT EXISTS public.institution_schedule_exception_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id uuid NOT NULL
    REFERENCES public.institution_schedule_exceptions(id) ON DELETE CASCADE,
  class_date date NOT NULL,
  schedule_slot_id uuid
    REFERENCES public.institution_weekly_schedule(id) ON DELETE SET NULL,
  schedule_series_id uuid NOT NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  display_label text NOT NULL,
  class_type text,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exception_id, class_date, schedule_series_id)
);

CREATE INDEX IF NOT EXISTS idx_exception_classes_exception
  ON public.institution_schedule_exception_classes(exception_id);

CREATE INDEX IF NOT EXISTS idx_exception_classes_match
  ON public.institution_schedule_exception_classes(class_date, schedule_series_id);

ALTER TABLE public.institution_schedule_exception_classes ENABLE ROW LEVEL SECURITY;

-- 선생님은 현재 활성 배정 원이거나, 행사 기간과 실제 수업 유효기간이
-- 겹치는 원의 일정만 조회할 수 있습니다. 종료된 과거 수업 이력만으로는
-- 이후 행사를 계속 조회할 수 없습니다.
DROP POLICY IF EXISTS "schedule_exceptions_teacher_read"
  ON public.institution_schedule_exceptions;

CREATE POLICY "schedule_exceptions_teacher_read"
  ON public.institution_schedule_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.institution_teacher_assignments a
      WHERE a.institution_id = institution_schedule_exceptions.institution_id
        AND a.teacher_id = auth.uid()
        AND a.is_active = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.institution_weekly_schedule w
      WHERE w.institution_id = institution_schedule_exceptions.institution_id
        AND w.teacher_id = auth.uid()
        AND (
          w.effective_from IS NULL
          OR w.effective_from <= coalesce(
            institution_schedule_exceptions.end_date,
            institution_schedule_exceptions.exception_date
          )
        )
        AND (
          w.effective_to IS NULL
          OR w.effective_to >= institution_schedule_exceptions.exception_date
        )
    )
  );

DROP POLICY IF EXISTS "exception_classes_select" ON public.institution_schedule_exception_classes;
CREATE POLICY "exception_classes_select"
  ON public.institution_schedule_exception_classes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.institution_schedule_exceptions e
      WHERE e.id = exception_id
    )
  );

DROP POLICY IF EXISTS "exception_classes_admin_write" ON public.institution_schedule_exception_classes;
CREATE POLICY "exception_classes_admin_write"
  ON public.institution_schedule_exception_classes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.institution_schedule_exceptions e
      WHERE e.id = exception_id
        AND public.manages_institution(e.institution_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.institution_schedule_exceptions e
      WHERE e.id = exception_id
        AND public.manages_institution(e.institution_id)
    )
  );

CREATE OR REPLACE FUNCTION public.save_schedule_exception_with_classes(
  p_id uuid,
  p_institution_id uuid,
  p_exception_date date,
  p_end_date date,
  p_exception_type text,
  p_note text,
  p_notice_id uuid,
  p_classes jsonb DEFAULT '[]'::jsonb
)
RETURNS public.institution_schedule_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_exception public.institution_schedule_exceptions;
  v_class_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF NOT public.manages_institution(p_institution_id) THEN
    RAISE EXCEPTION '해당 원의 일정을 관리할 권한이 없습니다.';
  END IF;
  IF p_end_date IS NOT NULL AND p_end_date < p_exception_date THEN
    RAISE EXCEPTION '종료일은 시작일보다 빠를 수 없습니다.';
  END IF;
  IF p_exception_type NOT IN (
    'cancelled', 'class_cancelled', 'cancelled_am',
    'cancelled_pm', 'event', 'time_change'
  ) THEN
    RAISE EXCEPTION '지원하지 않는 일정 유형입니다.';
  END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.institution_schedule_exceptions e
    WHERE e.id = p_id
      AND public.manages_institution(e.institution_id)
  ) THEN
    RAISE EXCEPTION '수정할 일정이 없거나 권한이 없습니다.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.institution_schedule_exceptions (
      institution_id, exception_date, end_date,
      exception_type, note, notice_id
    )
    VALUES (
      p_institution_id, p_exception_date, p_end_date,
      p_exception_type, nullif(trim(p_note), ''), p_notice_id
    )
    RETURNING * INTO v_exception;
  ELSE
    UPDATE public.institution_schedule_exceptions
    SET institution_id = p_institution_id,
        exception_date = p_exception_date,
        end_date = p_end_date,
        exception_type = p_exception_type,
        note = nullif(trim(p_note), ''),
        notice_id = p_notice_id
    WHERE id = p_id
    RETURNING * INTO v_exception;
    IF v_exception.id IS NULL THEN
      RAISE EXCEPTION '수정할 일정을 찾을 수 없습니다.';
    END IF;
  END IF;

  DELETE FROM public.institution_schedule_exception_classes
  WHERE exception_id = v_exception.id;

  IF p_exception_type = 'class_cancelled' THEN
    INSERT INTO public.institution_schedule_exception_classes (
      exception_id, class_date, schedule_slot_id, schedule_series_id,
      teacher_id, display_label, class_type, start_time, end_time
    )
    SELECT
      v_exception.id,
      x.class_date,
      s.id,
      coalesce(s.schedule_series_id, s.id),
      s.teacher_id,
      coalesce(nullif(trim(x.display_label), ''), s.label, '수업'),
      s.class_type,
      s.start_time,
      s.end_time
    FROM jsonb_to_recordset(coalesce(p_classes, '[]'::jsonb)) AS x(
      class_date date,
      schedule_slot_id uuid,
      display_label text
    )
    JOIN public.institution_weekly_schedule s
      ON s.id = x.schedule_slot_id
     AND s.institution_id = p_institution_id
     AND s.day_of_week = extract(dow FROM x.class_date)::integer
     AND (s.effective_from IS NULL OR s.effective_from <= x.class_date)
     AND (s.effective_to IS NULL OR s.effective_to >= x.class_date)
    WHERE x.class_date BETWEEN p_exception_date AND coalesce(p_end_date, p_exception_date)
    ON CONFLICT (exception_id, class_date, schedule_series_id) DO NOTHING;

    GET DIAGNOSTICS v_class_count = ROW_COUNT;
    IF v_class_count = 0 THEN
      RAISE EXCEPTION '휴강할 수업을 한 개 이상 선택해주세요.';
    END IF;
  END IF;

  RETURN v_exception;
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_schedule_exception_with_classes(
  uuid, uuid, date, date, text, text, uuid, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_schedule_exception_with_classes(
  uuid, uuid, date, date, text, text, uuid, jsonb
) TO authenticated;

COMMENT ON TABLE public.institution_schedule_exception_classes IS
  '원 휴강 시 날짜별로 선택된 실제 수업과 당시 표시 정보를 보존';
