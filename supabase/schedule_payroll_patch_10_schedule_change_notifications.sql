-- 강사 수업 변동 알림 (평소 스케줄과 다른 입력만)
-- schedule_payroll_patch_9_home_visit_schedules.sql 실행 후 적용

CREATE TABLE IF NOT EXISTS public.schedule_change_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  class_date date NOT NULL,
  schedule_slot_id uuid REFERENCES public.institution_weekly_schedule(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('skipped', 'custom')),
  original_schedule text NOT NULL,
  actual_handling text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_change_notifications_created
  ON public.schedule_change_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_change_notifications_unread
  ON public.schedule_change_notifications (is_read, created_at DESC)
  WHERE is_read = false;

COMMENT ON TABLE public.schedule_change_notifications IS
  '강사가 평소 스케줄과 다르게 입력(수업 안 함/시간 수정)한 경우 관리자 알림';

ALTER TABLE public.schedule_change_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_change_admin_read" ON public.schedule_change_notifications;
CREATE POLICY "schedule_change_admin_read" ON public.schedule_change_notifications
  FOR SELECT TO authenticated
  USING (public.is_schedule_admin());

DROP POLICY IF EXISTS "schedule_change_admin_update" ON public.schedule_change_notifications;
CREATE POLICY "schedule_change_admin_update" ON public.schedule_change_notifications
  FOR UPDATE TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "schedule_change_teacher_insert" ON public.schedule_change_notifications;
CREATE POLICY "schedule_change_teacher_insert" ON public.schedule_change_notifications
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
