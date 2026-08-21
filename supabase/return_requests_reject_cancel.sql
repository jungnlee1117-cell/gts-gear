-- 반납 거절/취소 상태용 컬럼
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS rejected_by uuid;

ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

COMMENT ON COLUMN public.return_requests.rejection_reason IS '관리자 반납 거절 사유 (선생님 알림에 표시)';
COMMENT ON COLUMN public.return_requests.rejected_by IS '반납 거절 처리자';
COMMENT ON COLUMN public.return_requests.rejected_at IS '반납 거절 시각';
