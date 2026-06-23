/** GTS 공식 등 먼저, manager_personal·partner_billing(담당자몫/GTS몫 —) 맨 아래 */
export function institutionContractSortKey(institution) {
  const type = institution?.contract_type;
  if (type === "manager_personal" || type === "partner_billing") return 1;
  return 0;
}

export function compareInstitutionDashboardRows(a, b, managerMap = {}) {
  const mgrIdA = a.displayManagerId !== undefined ? a.displayManagerId : a.institution?.manager_id;
  const mgrIdB = b.displayManagerId !== undefined ? b.displayManagerId : b.institution?.manager_id;
  const mgrA = managerMap[mgrIdA]?.name ?? "";
  const mgrB = managerMap[mgrIdB]?.name ?? "";
  const mgrCmp = mgrA.localeCompare(mgrB, "ko");
  if (mgrCmp !== 0) return mgrCmp;

  const keyA = institutionContractSortKey(a.institution);
  const keyB = institutionContractSortKey(b.institution);
  if (keyA !== keyB) return keyA - keyB;

  return (a.institution?.name ?? "").localeCompare(b.institution?.name ?? "", "ko");
}

export function compareSettlementRows(a, b) {
  const keyA = institutionContractSortKey(a.institutions);
  const keyB = institutionContractSortKey(b.institutions);
  if (keyA !== keyB) return keyA - keyB;
  return (a.institutions?.name ?? "").localeCompare(b.institutions?.name ?? "", "ko");
}

export function sortInstitutionDashboardRows(rows, managerMap, { groupByManager = true } = {}) {
  return [...rows].sort((a, b) => {
    if (groupByManager) return compareInstitutionDashboardRows(a, b, managerMap);
    const keyA = institutionContractSortKey(a.institution);
    const keyB = institutionContractSortKey(b.institution);
    if (keyA !== keyB) return keyA - keyB;
    return (a.institution?.name ?? "").localeCompare(b.institution?.name ?? "", "ko");
  });
}

export function sortSettlementRows(rows) {
  return [...rows].sort(compareSettlementRows);
}
