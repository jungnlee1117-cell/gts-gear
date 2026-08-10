-- additional_payment_requests: 승인 연결 컬럼 + rejection_reason 호환

ALTER TABLE public.additional_payment_requests
  ADD COLUMN IF NOT EXISTS additional_payment_id uuid
    REFERENCES public.additional_payments(id) ON DELETE SET NULL;

-- 코드는 rejection_reason 사용. DB에 rejected_reason만 있으면 동기화 컬럼 추가
ALTER TABLE public.additional_payment_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- rejected_reason 값이 있으면 rejection_reason으로 복사
UPDATE public.additional_payment_requests
SET rejection_reason = rejected_reason
WHERE rejection_reason IS NULL
  AND rejected_reason IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'additional_payment_requests'
      AND column_name = 'rejected_reason'
  );

COMMENT ON COLUMN public.additional_payment_requests.additional_payment_id IS
  '승인 시 생성된 additional_payments.id';
COMMENT ON COLUMN public.additional_payment_requests.rejection_reason IS
  '거절 사유';

NOTIFY pgrst, 'reload schema';
