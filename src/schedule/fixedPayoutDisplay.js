export const FIXED_PAYOUT_SLICE = {
  manager: "manager",
  gts: "gts",
};

export function isManagerFixedPayout(institution) {
  return institution?.contract_type === "manager_fixed_payout";
}

export function rowDisplayManagerId(row) {
  if (row.displayManagerId !== undefined) return row.displayManagerId;
  return row.institution?.manager_id ?? null;
}

/** 고정지급 원 → 담당자 그룹(고정액) + 본사 그룹(GTS 몫) 두 행 */
export function expandFixedPayoutDashboardRows(rows, managerFilter = "all") {
  const result = [];
  for (const row of rows) {
    if (!isManagerFixedPayout(row.institution)) {
      result.push({
        ...row,
        displayKey: row.institution.id,
        displayManagerId: row.institution.manager_id ?? null,
        displaySlice: null,
      });
      continue;
    }
    const id = row.institution.id;
    if (managerFilter === "all" || managerFilter === "oh") {
      result.push({
        ...row,
        displayKey: `${id}:${FIXED_PAYOUT_SLICE.manager}`,
        displayManagerId: row.institution.manager_id ?? null,
        displaySlice: FIXED_PAYOUT_SLICE.manager,
      });
    }
    if (managerFilter === "all" || managerFilter === "hq") {
      result.push({
        ...row,
        displayKey: `${id}:${FIXED_PAYOUT_SLICE.gts}`,
        displayManagerId: null,
        displaySlice: FIXED_PAYOUT_SLICE.gts,
      });
    }
  }
  return result;
}

export function filterInstitutionRowsForManager(rows, managerFilter, ids) {
  return rows.filter(row => {
    if (managerFilter === "all") return true;
    if (managerFilter === "hq") {
      return !row.institution.manager_id || isManagerFixedPayout(row.institution);
    }
    if (managerFilter === "yang") return row.institution.manager_id === ids.yangId;
    if (managerFilter === "oh") return row.institution.manager_id === ids.ohId;
    if (managerFilter === "self") {
      return row.institution.manager_id === ids.selfId;
    }
    return true;
  });
}

export function expandFixedPayoutSettlements(settlements) {
  const regular = new Map();
  const partner = [];
  for (const s of settlements) {
    if (s.institutions?.contract_type === "partner_billing") {
      partner.push(s);
      continue;
    }
    const inst = s.institutions;
    if (isManagerFixedPayout(inst)) {
      const mgrId = inst.manager_id || "none";
      if (!regular.has(mgrId)) regular.set(mgrId, []);
      regular.get(mgrId).push({
        ...s,
        displayKey: `${s.id}:${FIXED_PAYOUT_SLICE.manager}`,
        displaySlice: FIXED_PAYOUT_SLICE.manager,
      });
      if (!regular.has("none")) regular.set("none", []);
      regular.get("none").push({
        ...s,
        displayKey: `${s.id}:${FIXED_PAYOUT_SLICE.gts}`,
        displaySlice: FIXED_PAYOUT_SLICE.gts,
      });
      continue;
    }
    const mgrId = inst?.manager_id || "none";
    if (!regular.has(mgrId)) regular.set(mgrId, []);
    regular.get(mgrId).push({
      ...s,
      displayKey: s.id,
      displaySlice: null,
    });
  }
  return { regular, partner };
}

export function isFixedPayoutManagerSlice(row) {
  return row?.displaySlice === FIXED_PAYOUT_SLICE.manager;
}

export function isFixedPayoutGtsSlice(row) {
  return row?.displaySlice === FIXED_PAYOUT_SLICE.gts;
}
