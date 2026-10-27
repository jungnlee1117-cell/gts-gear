-- 원 관리: 계약 종료일
alter table public.institutions
  add column if not exists contract_end_date date;
