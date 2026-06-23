-- 수업 변동 알림: pay_type 저장 + class_date 월별 조회 인덱스
-- schedule_payroll_patch_10_schedule_change_notifications.sql 실행 후 적용

ALTER TABLE public.schedule_change_notifications
  ADD COLUMN IF NOT EXISTS pay_type text;

ALTER TABLE public.schedule_change_notifications
  ADD COLUMN IF NOT EXISTS home_visit_pattern_id uuid
    REFERENCES public.home_visit_patterns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_change_notifications_class_date
  ON public.schedule_change_notifications (class_date DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_change_notifications_pay_type
  ON public.schedule_change_notifications (pay_type, class_date DESC)
  WHERE pay_type IS NOT NULL;

COMMENT ON COLUMN public.schedule_change_notifications.pay_type IS
  '정규/방과후/가정방문/센터/센터보조 — 유형 필터용';

-- 기존 행: original_schedule 끝의 유형명으로 backfill (예: "09:50-10:30 정규")
UPDATE public.schedule_change_notifications
SET pay_type = sub.pt
FROM (
  SELECT id,
    CASE
      WHEN original_schedule ~ ' 가정방문$' THEN '가정방문'
      WHEN original_schedule ~ ' 방과후$' THEN '방과후'
      WHEN original_schedule ~ ' 정규$' THEN '정규'
      WHEN original_schedule ~ ' 센터$' THEN '센터'
      WHEN original_schedule ~ ' 센터보조$' THEN '센터보조'
      ELSE NULL
    END AS pt
  FROM public.schedule_change_notifications
  WHERE pay_type IS NULL
) sub
WHERE schedule_change_notifications.id = sub.id
  AND sub.pt IS NOT NULL;
