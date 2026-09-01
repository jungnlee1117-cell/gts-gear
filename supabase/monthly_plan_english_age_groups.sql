-- 영어 월간 계획안을 AGE 5, AGE 6, AGE 7로 나누기 위한 추가 패치입니다.
-- 기존 'en' 데이터는 삭제하지 않으며, 앱에서 처음 불러올 때 각 연령의 기본값으로 사용합니다.

ALTER TABLE public.monthly_plan_draft_entries
  DROP CONSTRAINT IF EXISTS monthly_plan_draft_entries_age_group_check;

ALTER TABLE public.monthly_plan_draft_entries
  ADD CONSTRAINT monthly_plan_draft_entries_age_group_check
  CHECK (age_group IN ('3_4', '5', '7', 'en', 'en_5', 'en_6', 'en_7'));

COMMENT ON COLUMN public.monthly_plan_draft_entries.age_group IS
  '한국어: 3_4, 5, 7 / 기존 영어: en / 연령별 영어: en_5, en_6, en_7';
