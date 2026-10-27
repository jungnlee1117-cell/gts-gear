-- 원 관리: 계약 종료일
alter table public.institutions
  add column if not exists contract_end_date date;

-- API 스키마 캐시 새로고침 (저장 시 "schema cache" 오류 방지)
notify pgrst, 'reload schema';
