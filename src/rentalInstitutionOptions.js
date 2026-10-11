export const GEAR_ADMIN_RENTAL_LOCATION = "교구 관리자 대여";
export const NO_RENTAL_INSTITUTION_MESSAGE = "등록된 소속 기관이 없습니다. 관리자에게 문의해 주세요.";

export function dedupeActiveInstitutions(rows) {
  const unique = new Map();
  for (const institution of rows || []) {
    if (institution?.id && institution?.name && institution.is_active !== false) {
      unique.set(institution.id, {
        id: institution.id,
        name: institution.name,
        is_active: institution.is_active !== false,
      });
    }
  }
  return [...unique.values()];
}

/** 교구 관리자·스케줄 관리자는 기관 목록 뒤에 기관 없는 대여를 붙인다. */
export function withGearAdminRentalChoice(institutions, canChooseAll) {
  const rows = dedupeActiveInstitutions(institutions);
  if (!canChooseAll) return rows;
  if (rows.some((row) => row.name === GEAR_ADMIN_RENTAL_LOCATION)) return rows;
  return [
    ...rows,
    {
      id: "gear-admin-rental",
      name: GEAR_ADMIN_RENTAL_LOCATION,
      is_active: true,
      synthetic: true,
    },
  ];
}

export function shouldAutofillRentalLocation({ loading, canChoose, options }) {
  if (loading || options?.length !== 1) return false;
  if (!canChoose) return true;
  return Boolean(options[0]?.synthetic);
}

export function resolveChosenRentalLocation(requestedName, options, canChooseAll) {
  if (!options?.length) throw new Error(NO_RENTAL_INSTITUTION_MESSAGE);
  if (!canChooseAll && options.length === 1) return options[0].name;
  const name = String(requestedName || "").trim();
  if (canChooseAll && name === GEAR_ADMIN_RENTAL_LOCATION) return GEAR_ADMIN_RENTAL_LOCATION;
  const matched = options.find((institution) => institution.name === name);
  if (!matched) throw new Error("사용 기관을 선택해 주세요.");
  return matched.name;
}

export function isMissingRentalInstitutionRpc(error) {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  const message = error.message || "";
  return /get_rental_institution_options/i.test(message)
    && /could not find|does not exist|schema cache/i.test(message);
}

export async function loadRentalInstitutionOptions(client, me, { canChooseAll }) {
  if (!me?.id) throw new Error("로그인 정보를 확인할 수 없습니다.");
  if (!canChooseAll) {
    const { data, error } = await client.rpc("get_teacher_assigned_institutions");
    if (error) throw error;
    return dedupeActiveInstitutions(data);
  }

  const rpc = await client.rpc("get_rental_institution_options");
  if (!rpc.error) return withGearAdminRentalChoice(rpc.data, true);
  if (!isMissingRentalInstitutionRpc(rpc.error)) throw rpc.error;

  const fallback = await client
    .from("institutions")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name");
  if (fallback.error) throw fallback.error;
  return withGearAdminRentalChoice(fallback.data, true);
}
