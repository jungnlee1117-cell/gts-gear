BEGIN;
-- Dedicated contract ownership; never inherit general admin/superadmin roles.
CREATE OR REPLACE FUNCTION public.is_contract_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT coalesce(auth.uid() = '252756b8-8ba6-4701-a41f-812b5f5b6a8c'::uuid, false); $$;
REVOKE ALL ON FUNCTION public.is_contract_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_contract_owner() TO anon, authenticated, service_role;
UPDATE storage.buckets SET public = false WHERE id = 'teacher-contracts';
ALTER TABLE public.teacher_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contracts_private_read ON public.teacher_contracts;
CREATE POLICY contracts_private_read ON public.teacher_contracts AS RESTRICTIVE FOR SELECT TO public USING (public.is_contract_owner() OR (teacher_id = auth.uid()));
DROP POLICY IF EXISTS contracts_owner_insert ON public.teacher_contracts;
CREATE POLICY contracts_owner_insert ON public.teacher_contracts AS RESTRICTIVE FOR INSERT TO public WITH CHECK (public.is_contract_owner() AND (status = '서명대기'));
DROP POLICY IF EXISTS contracts_owner_update ON public.teacher_contracts;
CREATE POLICY contracts_owner_update ON public.teacher_contracts AS RESTRICTIVE FOR UPDATE TO public USING (public.is_contract_owner() AND (status = '서명대기')) WITH CHECK (public.is_contract_owner() AND (status = '서명대기'));
DROP POLICY IF EXISTS contracts_owner_delete ON public.teacher_contracts;
CREATE POLICY contracts_owner_delete ON public.teacher_contracts AS RESTRICTIVE FOR DELETE TO public USING (public.is_contract_owner() AND (status = '서명대기'));
ALTER TABLE public.teacher_contract_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contracts_private_read ON public.teacher_contract_rates;
CREATE POLICY contracts_private_read ON public.teacher_contract_rates AS RESTRICTIVE FOR SELECT TO public USING (public.is_contract_owner() OR (EXISTS (SELECT 1 FROM public.teacher_contracts c WHERE c.id = contract_id AND c.teacher_id = auth.uid())));
DROP POLICY IF EXISTS contracts_owner_insert ON public.teacher_contract_rates;
CREATE POLICY contracts_owner_insert ON public.teacher_contract_rates AS RESTRICTIVE FOR INSERT TO public WITH CHECK (public.is_contract_owner() AND (EXISTS (SELECT 1 FROM public.teacher_contracts c WHERE c.id = contract_id AND c.status = '서명대기')));
DROP POLICY IF EXISTS contracts_owner_update ON public.teacher_contract_rates;
CREATE POLICY contracts_owner_update ON public.teacher_contract_rates AS RESTRICTIVE FOR UPDATE TO public USING (public.is_contract_owner() AND (EXISTS (SELECT 1 FROM public.teacher_contracts c WHERE c.id = contract_id AND c.status = '서명대기'))) WITH CHECK (public.is_contract_owner() AND (EXISTS (SELECT 1 FROM public.teacher_contracts c WHERE c.id = contract_id AND c.status = '서명대기')));
DROP POLICY IF EXISTS contracts_owner_delete ON public.teacher_contract_rates;
CREATE POLICY contracts_owner_delete ON public.teacher_contract_rates AS RESTRICTIVE FOR DELETE TO public USING (public.is_contract_owner() AND (EXISTS (SELECT 1 FROM public.teacher_contracts c WHERE c.id = contract_id AND c.status = '서명대기')));
DROP POLICY IF EXISTS contract_files_private_read ON storage.objects;
CREATE POLICY contract_files_private_read ON storage.objects AS RESTRICTIVE FOR SELECT TO public
USING (bucket_id <> 'teacher-contracts' OR public.is_contract_owner() OR EXISTS (
 SELECT 1 FROM public.teacher_contracts c WHERE c.teacher_id = auth.uid()
 AND storage.objects.name IN (c.original_pdf_path, c.signed_pdf_path)
));
DROP POLICY IF EXISTS contract_files_owner_insert ON storage.objects;
CREATE POLICY contract_files_owner_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO public WITH CHECK ((bucket_id <> 'teacher-contracts' OR public.is_contract_owner()));
DROP POLICY IF EXISTS contract_files_owner_update ON storage.objects;
CREATE POLICY contract_files_owner_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO public USING ((bucket_id <> 'teacher-contracts' OR public.is_contract_owner())) WITH CHECK ((bucket_id <> 'teacher-contracts' OR public.is_contract_owner()));
DROP POLICY IF EXISTS contract_files_owner_delete ON storage.objects;
CREATE POLICY contract_files_owner_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO public USING ((bucket_id <> 'teacher-contracts' OR public.is_contract_owner())) ;
COMMIT;
