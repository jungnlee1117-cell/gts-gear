-- 세무 엑셀: 위탁수업 / 계약직 / 사업자 3분류 + 계약직 공제 내역 저장
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.payroll_tax_report_snapshots'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%income_type%'
  loop
    execute format('alter table public.payroll_tax_report_snapshots drop constraint %I', c);
  end loop;
end $$;

alter table public.payroll_tax_report_snapshots
  add constraint payroll_tax_report_snapshots_income_type_check
  check (income_type in ('위탁수업', '계약직', '사업자'));

alter table public.payroll_tax_report_snapshots
  add column if not exists deductions jsonb;

notify pgrst, 'reload schema';
