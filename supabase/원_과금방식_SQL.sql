-- 원 관리: 과금방식을 앱에서 직접 바꾼 원 표시 (옛 데이터 자동 추정보다 우선)
alter table public.institutions
  add column if not exists billing_type_explicit boolean not null default false;

notify pgrst, 'reload schema';
