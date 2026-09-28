-- 영어 월간 계획안에 AGE 4(en_4)를 추가합니다.

ALTER TABLE public.monthly_plan_draft_entries
  DROP CONSTRAINT IF EXISTS monthly_plan_draft_entries_age_group_check;

ALTER TABLE public.monthly_plan_draft_entries
  ADD CONSTRAINT monthly_plan_draft_entries_age_group_check
  CHECK (age_group IN ('3_4', '5', '7', 'en', 'en_4', 'en_5', 'en_6', 'en_7'));

COMMENT ON COLUMN public.monthly_plan_draft_entries.age_group IS
  '한국어: 3_4, 5, 7 / 기존 영어: en / 연령별 영어: en_4, en_5, en_6, en_7';
