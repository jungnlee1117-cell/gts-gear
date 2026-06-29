-- 2026년 7월 주차 (item_rotation_month_weeks)
-- 출처: supabase/data/item_rotation_month_weeks.json → "2026-07"
-- 규칙: 월요일 시작 ~ 일요일 끝, 과반수 날짜 기준 7월 N주차
--   1주차 6/29(월)~7/5(일)  — 6월 5주차가 아닌 7월 1주차
-- Supabase SQL Editor에서 실행

DELETE FROM public.item_rotation_month_weeks
WHERE year_month = '2026-07-01';

INSERT INTO public.item_rotation_month_weeks (year_month, week_number, week_start_date, week_end_date)
VALUES
  ('2026-07-01', 1, '2026-06-29', '2026-07-05'),
  ('2026-07-01', 2, '2026-07-06', '2026-07-12'),
  ('2026-07-01', 3, '2026-07-13', '2026-07-19'),
  ('2026-07-01', 4, '2026-07-20', '2026-07-26'),
  ('2026-07-01', 5, '2026-07-27', '2026-08-02');
