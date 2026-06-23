-- schedule_change_notifications: 스케줄 외 직접 추가 알림 유형
ALTER TABLE public.schedule_change_notifications
  DROP CONSTRAINT IF EXISTS schedule_change_notifications_change_type_check;

ALTER TABLE public.schedule_change_notifications
  ADD CONSTRAINT schedule_change_notifications_change_type_check
  CHECK (change_type IN ('skipped', 'custom', 'extra_added'));

COMMENT ON TABLE public.schedule_change_notifications IS
  '강사 수업 변동 알림: 수업 안 함, 시간 수정, 스케줄 외 직접 추가';
