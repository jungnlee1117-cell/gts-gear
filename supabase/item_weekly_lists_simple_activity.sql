-- item_weekly_lists: 간단한 활동 설명 (참고용 한 줄)
ALTER TABLE public.item_weekly_lists
  ADD COLUMN IF NOT EXISTS simple_activity text;

COMMENT ON COLUMN public.item_weekly_lists.simple_activity IS
  '교구별 간단 활동 참고 문구 (강사 화면 표시용, 선택 입력)';
