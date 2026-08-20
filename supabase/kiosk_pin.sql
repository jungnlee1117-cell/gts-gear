-- 키오스크 PIN (additive)
-- PIN 원문은 저장하지 않고 HMAC 해시만 보관한다.
-- teachers.select('*') 로 해시가 유출되지 않도록 별도 테이블을 사용한다.
-- teachers.has_kiosk_pin 은 UI용 플래그(PIN 설정 여부)만 표시.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS has_kiosk_pin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teachers.has_kiosk_pin IS
  '키오스크 개인 PIN 설정 여부. 실제 PIN/해시는 teacher_kiosk_pins 에만 저장.';

CREATE TABLE IF NOT EXISTS public.teacher_kiosk_pins (
  teacher_id uuid PRIMARY KEY REFERENCES public.teachers(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.teacher_kiosk_pins IS
  '키오스크 개인 PIN HMAC 해시. 클라이언트 SELECT 금지 — Edge Function(service_role)만 접근.';
COMMENT ON COLUMN public.teacher_kiosk_pins.pin_hash IS
  'HMAC-SHA256(hex). 원문 PIN·복호화 가능 암호문 저장 금지.';

ALTER TABLE public.teacher_kiosk_pins ENABLE ROW LEVEL SECURITY;

-- authenticated/anon 정책 없음 → 클라이언트 직접 접근 불가
DROP POLICY IF EXISTS "teacher_kiosk_pins_deny_all" ON public.teacher_kiosk_pins;

REVOKE ALL ON public.teacher_kiosk_pins FROM PUBLIC;
REVOKE ALL ON public.teacher_kiosk_pins FROM anon;
REVOKE ALL ON public.teacher_kiosk_pins FROM authenticated;
GRANT ALL ON public.teacher_kiosk_pins TO service_role;

-- 키오스크 대여 감사 로그 (선택, 조회용)
CREATE TABLE IF NOT EXISTS public.kiosk_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  item_id uuid,
  quantity integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kiosk_action_audit IS
  '키오스크 대여/반납 감사. PIN·개인정보는 meta 에 넣지 않는다.';

CREATE INDEX IF NOT EXISTS kiosk_action_audit_created_idx
  ON public.kiosk_action_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_action_audit_teacher_idx
  ON public.kiosk_action_audit (teacher_id, created_at DESC);

ALTER TABLE public.kiosk_action_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kiosk_action_audit FROM PUBLIC;
REVOKE ALL ON public.kiosk_action_audit FROM anon;
REVOKE ALL ON public.kiosk_action_audit FROM authenticated;
GRANT ALL ON public.kiosk_action_audit TO service_role;

-- superadmin 조회만 허용 (선택)
DROP POLICY IF EXISTS "kiosk_audit_superadmin_select" ON public.kiosk_action_audit;
CREATE POLICY "kiosk_audit_superadmin_select" ON public.kiosk_action_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role = 'superadmin'
    )
  );

GRANT SELECT ON public.kiosk_action_audit TO authenticated;
