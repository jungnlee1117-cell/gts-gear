-- 교구 예약 테이블
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  rejection_reason text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rental_request_id uuid REFERENCES public.rental_requests(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS reservations_teacher_id_idx ON public.reservations(teacher_id);
CREATE INDEX IF NOT EXISTS reservations_item_id_idx ON public.reservations(item_id);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON public.reservations(status);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
CREATE POLICY "reservations_select" ON public.reservations
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_item_admin()
  );

DROP POLICY IF EXISTS "reservations_insert_own" ON public.reservations;
CREATE POLICY "reservations_insert_own" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations
  FOR UPDATE TO authenticated
  USING (
    (teacher_id = auth.uid() AND status = 'pending')
    OR public.is_item_admin()
  );
