-- 퇴직했거나 비활성화된 선생님 계정을 슈퍼관리자가 삭제할 수 있게 한다.
-- 대여 중인 교구가 있으면 삭제하지 않는다.
-- 다른 사람의 급여·재고 기록은 남기고, 작성자만 걸린 칸은 삭제 실행자로 옮긴다.

CREATE OR REPLACE FUNCTION public.delete_departed_teacher(p_teacher_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_teacher public.teachers%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teachers
    WHERE id = v_actor AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION '슈퍼관리자만 삭제할 수 있습니다.';
  END IF;
  IF p_teacher_id = v_actor THEN
    RAISE EXCEPTION '본인 계정은 삭제할 수 없습니다.';
  END IF;

  SELECT * INTO v_teacher FROM public.teachers WHERE id = p_teacher_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '선생님을 찾지 못했습니다.';
  END IF;
  IF v_teacher.role = 'superadmin' THEN
    RAISE EXCEPTION '슈퍼관리자 계정은 삭제할 수 없습니다.';
  END IF;
  IF v_teacher.resigned_at IS NULL AND v_teacher.active IS DISTINCT FROM false THEN
    RAISE EXCEPTION '퇴직했거나 비활성화된 선생님만 삭제할 수 있습니다.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.rental_items ri
    JOIN public.rental_requests rr ON rr.id = ri.request_id
    WHERE rr.teacher_id = p_teacher_id
      AND ri.status IN ('rented', 'partial_returned')
  ) THEN
    RAISE EXCEPTION '반납되지 않은 교구가 있어 삭제할 수 없습니다.';
  END IF;

  UPDATE public.activity_logs SET actor_id = NULL WHERE actor_id = p_teacher_id;
  UPDATE public.activity_logs SET target_id = NULL WHERE target_id = p_teacher_id;
  UPDATE public.additional_payment_requests SET reviewed_by = NULL WHERE reviewed_by = p_teacher_id;
  UPDATE public.additional_payment_requests SET teacher_id = NULL WHERE teacher_id = p_teacher_id;
  UPDATE public.additional_payments SET created_by = v_actor WHERE created_by = p_teacher_id;
  UPDATE public.institution_weekly_schedule SET teacher_id = NULL WHERE teacher_id = p_teacher_id;
  UPDATE public.institutions SET fixed_payout_recipient_id = NULL WHERE fixed_payout_recipient_id = p_teacher_id;
  UPDATE public.institutions SET manager_id = NULL WHERE manager_id = p_teacher_id;
  UPDATE public.item_quantity_adjustments SET teacher_id = v_actor WHERE teacher_id = p_teacher_id;
  UPDATE public.items SET last_returned_by = NULL WHERE last_returned_by = p_teacher_id;
  UPDATE public.rental_items SET approved_by = NULL WHERE approved_by = p_teacher_id;
  UPDATE public.rental_requests SET approved_by = NULL WHERE approved_by = p_teacher_id;
  UPDATE public.rental_requests SET rejected_by = NULL WHERE rejected_by = p_teacher_id;
  UPDATE public.rental_requests SET teacher_id = NULL WHERE teacher_id = p_teacher_id;
  UPDATE public.reservations SET teacher_id = NULL WHERE teacher_id = p_teacher_id;
  UPDATE public.resource_folders SET teacher_id = v_actor WHERE teacher_id = p_teacher_id;
  UPDATE public.return_requests SET approved_by = NULL WHERE approved_by = p_teacher_id;
  UPDATE public.return_requests SET teacher_id = NULL WHERE teacher_id = p_teacher_id;
  UPDATE public.teacher_contracts SET created_by = NULL WHERE created_by = p_teacher_id;
  UPDATE public.teacher_contracts SET signed_by = NULL WHERE signed_by = p_teacher_id;
  UPDATE public.teacher_settlement_profiles SET updated_by = NULL WHERE updated_by = p_teacher_id;
  DELETE FROM public.teacher_settlement_reveal_audit
  WHERE teacher_id = p_teacher_id OR viewer_id = p_teacher_id;
  UPDATE public.temp_teachers SET created_by = NULL WHERE created_by = p_teacher_id;
  UPDATE public.temp_teachers SET substitute_teacher_id = NULL WHERE substitute_teacher_id = p_teacher_id;

  DELETE FROM public.teachers WHERE id = p_teacher_id;
  DELETE FROM auth.users WHERE id = p_teacher_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_departed_teacher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_departed_teacher(uuid) TO authenticated;
