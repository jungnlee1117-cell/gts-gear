-- 강사: 배정된 원의 institution_monthly_contracts.student_count 읽기
-- (원 수업 일정 화면 인원 수 표시용)

DROP POLICY IF EXISTS "monthly_contracts_teacher_read" ON public.institution_monthly_contracts;
CREATE POLICY "monthly_contracts_teacher_read" ON public.institution_monthly_contracts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_teacher_assignments a
      WHERE a.institution_id = institution_monthly_contracts.institution_id
        AND a.teacher_id = auth.uid()
        AND a.is_active = true
    )
  );
