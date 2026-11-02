-- 1) 월급제(계약직) 급여명세서 저장 테이블 (오주영 선생님 등)
create table if not exists public.salary_payslips (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  year_month date not null,               -- 해당 월 1일
  pay_date date,
  hire_date date,
  earnings jsonb not null default '{}'::jsonb,    -- 지급내역 {기본급: 2400000, ...}
  deductions jsonb not null default '{}'::jsonb,  -- 공제내역 {국민연금: 123500, ...}
  bonus_note text,                        -- 보너스/상여 사유
  memo text,
  paid boolean not null default false,    -- 지급 완료
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, year_month)
);

alter table public.salary_payslips enable row level security;

drop policy if exists "salary_payslips_superadmin_all" on public.salary_payslips;
create policy "salary_payslips_superadmin_all" on public.salary_payslips
  for all to authenticated
  using (public.is_teacher_superadmin())
  with check (public.is_teacher_superadmin());

-- 본인 명세서는 본인이 조회 가능
drop policy if exists "salary_payslips_self_select" on public.salary_payslips;
create policy "salary_payslips_self_select" on public.salary_payslips
  for select to authenticated
  using (teacher_id = auth.uid());

-- 2) 사업자 대 사업자(3.3% 공제 없음, 사업자등록번호 사용) 대상
--    와이에이에듀·올바른키즈는 이미 partner 이므로 아래 이름만 추가 지정합니다.
update public.teachers
set payee_kind = 'partner'
where name in ('양의인', '오정석', '엘리트코어', '와이에이에듀');

-- 확인용
select name, payee_kind from public.teachers where payee_kind = 'partner' order by name;

notify pgrst, 'reload schema';
