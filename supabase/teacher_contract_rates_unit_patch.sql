-- 이미 teacher_contract_rates.sql 을 실행한 환경용 additive patch
-- 단위를 hour/session/day/month/item 코드로 저장하고, 발행 스냅샷 컬럼을 추가한다.

ALTER TABLE public.teacher_contracts
  ADD COLUMN IF NOT EXISTS phone_snapshot text,
  ADD COLUMN IF NOT EXISTS resident_id_front text;

COMMENT ON COLUMN public.teacher_contracts.phone_snapshot IS '발행 시점 연락처 스냅샷';
COMMENT ON COLUMN public.teacher_contracts.resident_id_front IS '주민등록번호 앞 6자리만. 전체 원문 저장 금지';

ALTER TABLE public.teacher_contract_rates
  DROP CONSTRAINT IF EXISTS teacher_contract_rates_unit_check;

UPDATE public.teacher_contract_rates
SET unit = CASE unit
  WHEN '시간' THEN 'hour'
  WHEN '회' THEN 'session'
  WHEN '일' THEN 'day'
  WHEN '월' THEN 'month'
  WHEN '건' THEN 'item'
  ELSE unit
END
WHERE unit IN ('시간', '회', '일', '월', '건');

ALTER TABLE public.teacher_contract_rates
  ADD CONSTRAINT teacher_contract_rates_unit_check
  CHECK (unit = ANY (ARRAY['hour'::text, 'session'::text, 'day'::text, 'month'::text, 'item'::text]));
