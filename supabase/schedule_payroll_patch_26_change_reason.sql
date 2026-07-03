-- schedule_change_notifications: 변동 사유
-- schedule_payroll_patch_10 이후 적용

ALTER TABLE public.schedule_change_notifications
  ADD COLUMN IF NOT EXISTS change_reason text;

COMMENT ON COLUMN public.schedule_change_notifications.change_reason IS
  '수업 변동 사유 (선생님 개인 사정, 기관 휴원, 공휴일, 대체 수업 등)';
