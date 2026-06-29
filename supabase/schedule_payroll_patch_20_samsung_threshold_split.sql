-- Play by GTS 삼성 센터 — 100만원 기준 분배 정산
-- schedule_payroll_patch_3_billing.sql 이후 적용

ALTER TABLE public.institutions DROP CONSTRAINT IF EXISTS institutions_contract_type_check;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_contract_type_check
  CHECK (contract_type IN (
    'gts_official',
    'manager_personal',
    'manager_fixed_payout',
    'partner_billing',
    'manager_threshold_split'
  ));

ALTER TABLE public.institution_monthly_contracts
  ADD COLUMN IF NOT EXISTS external_instructor_cost numeric(12, 0) NOT NULL DEFAULT 0;

UPDATE public.institutions
SET contract_type = 'manager_threshold_split'
WHERE name = 'Play by GTS 삼성 센터';
