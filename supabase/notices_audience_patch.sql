-- notices: 수신 대상 (audience_type / audience_teacher_ids)
-- Supabase SQL Editor에서 실행
-- 선행: notices_institution_scope_patch.sql

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'all';

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS audience_teacher_ids uuid[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  ALTER TABLE public.notices
    ADD CONSTRAINT notices_audience_type_check
    CHECK (audience_type IN ('all', 'teachers', 'institution_teachers', 'specific'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 기존 기관 한정 공지 → 특정 기관 선생님
UPDATE public.notices
SET audience_type = 'institution_teachers'
WHERE institution_id IS NOT NULL
  AND audience_type = 'all';

COMMENT ON COLUMN public.notices.audience_type IS
  'all=전체(슈퍼·관리·선생님), teachers=선생님만, institution_teachers=특정 기관 선생님, specific=지정 선생님';
COMMENT ON COLUMN public.notices.audience_teacher_ids IS
  'audience_type=specific 일 때 수신 선생님 id 목록';

CREATE INDEX IF NOT EXISTS idx_notices_audience_type
  ON public.notices (audience_type);

CREATE INDEX IF NOT EXISTS idx_notices_audience_teacher_ids
  ON public.notices USING GIN (audience_teacher_ids);

DROP POLICY IF EXISTS "notices_select" ON public.notices;
CREATE POLICY "notices_select" ON public.notices
  FOR SELECT TO authenticated
  USING (
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
            AND COALESCE(a.role, 'teacher') = 'teacher'
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
  );
