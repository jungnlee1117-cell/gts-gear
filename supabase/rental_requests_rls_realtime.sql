-- 교구 대여/반납 RLS 정리 + Realtime publication
-- schedule_payroll_patch_17_item_admin.sql (is_item_admin) 적용 후 실행
--
-- Security Advisor RLS 경고·관리자 SELECT 누락·Realtime 미반영 대응

-- ============================================
-- rental_requests
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.rental_requests') IS NULL THEN
    RAISE NOTICE 'public.rental_requests 없음 — 스킵';
    RETURN;
  END IF;

  ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "rental_requests_select" ON public.rental_requests;
  CREATE POLICY "rental_requests_select" ON public.rental_requests
    FOR SELECT TO authenticated
    USING (
      teacher_id = auth.uid()
      OR public.is_item_admin()
    );

  DROP POLICY IF EXISTS "rental_requests_insert_own" ON public.rental_requests;
  CREATE POLICY "rental_requests_insert_own" ON public.rental_requests
    FOR INSERT TO authenticated
    WITH CHECK (teacher_id = auth.uid());

  DROP POLICY IF EXISTS "rental_requests_update" ON public.rental_requests;
  CREATE POLICY "rental_requests_update" ON public.rental_requests
    FOR UPDATE TO authenticated
    USING (
      (teacher_id = auth.uid() AND status = 'pending')
      OR public.is_item_admin()
    )
    WITH CHECK (
      (teacher_id = auth.uid() AND status IN ('pending', 'cancelled'))
      OR public.is_item_admin()
    );
END $$;

-- ============================================
-- rental_items
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.rental_items') IS NULL THEN
    RAISE NOTICE 'public.rental_items 없음 — 스킵';
    RETURN;
  END IF;

  ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "rental_items_select" ON public.rental_items;
  CREATE POLICY "rental_items_select" ON public.rental_items
    FOR SELECT TO authenticated
    USING (
      public.is_item_admin()
      OR EXISTS (
        SELECT 1 FROM public.rental_requests rr
        WHERE rr.id = rental_items.request_id
          AND rr.teacher_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "rental_items_insert_own" ON public.rental_items;
  CREATE POLICY "rental_items_insert_own" ON public.rental_items
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.rental_requests rr
        WHERE rr.id = rental_items.request_id
          AND rr.teacher_id = auth.uid()
          AND rr.status = 'pending'
      )
      OR public.is_item_admin()
    );

  DROP POLICY IF EXISTS "rental_items_update" ON public.rental_items;
  CREATE POLICY "rental_items_update" ON public.rental_items
    FOR UPDATE TO authenticated
    USING (
      public.is_item_admin()
      OR EXISTS (
        SELECT 1 FROM public.rental_requests rr
        WHERE rr.id = rental_items.request_id
          AND rr.teacher_id = auth.uid()
          AND rr.status = 'pending'
      )
    )
    WITH CHECK (
      public.is_item_admin()
      OR EXISTS (
        SELECT 1 FROM public.rental_requests rr
        WHERE rr.id = rental_items.request_id
          AND rr.teacher_id = auth.uid()
      )
    );
END $$;

-- ============================================
-- return_requests
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.return_requests') IS NULL THEN
    RAISE NOTICE 'public.return_requests 없음 — 스킵';
    RETURN;
  END IF;

  ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "return_requests_select" ON public.return_requests;
  CREATE POLICY "return_requests_select" ON public.return_requests
    FOR SELECT TO authenticated
    USING (
      teacher_id = auth.uid()
      OR public.is_item_admin()
    );

  DROP POLICY IF EXISTS "return_requests_insert_own" ON public.return_requests;
  CREATE POLICY "return_requests_insert_own" ON public.return_requests
    FOR INSERT TO authenticated
    WITH CHECK (teacher_id = auth.uid());

  DROP POLICY IF EXISTS "return_requests_update" ON public.return_requests;
  CREATE POLICY "return_requests_update" ON public.return_requests
    FOR UPDATE TO authenticated
    USING (
      (teacher_id = auth.uid() AND status = 'return_pending')
      OR public.is_item_admin()
    )
    WITH CHECK (
      teacher_id = auth.uid()
      OR public.is_item_admin()
    );
END $$;

-- ============================================
-- Realtime publication (Dashboard → Database → Replication 에서도 확인)
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.rental_requests') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_requests;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.rental_items') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_items;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.return_requests') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.return_requests;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.reservations') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
