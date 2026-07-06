/** 일회성 수업 기관 목록 — 활성 원 + 직영 센터(비활성 포함) */
const CENTER_NAME_KEYWORDS = [
  "센터",
  "엘리트코어",
  "elitecore",
  "elite core",
  "play by gts",
  "한남",
  "삼성",
];

export function isDirectCenterInstitution(institution) {
  const name = String(institution?.name || "").trim().toLowerCase();
  if (!name) return false;
  return CENTER_NAME_KEYWORDS.some(keyword => name.includes(keyword));
}

export function listInstitutionsForOneoffLesson(institutions) {
  const rows = institutions || [];
  const included = rows.filter(inst => {
    if (inst.is_active !== false) return true;
    return isDirectCenterInstitution(inst);
  });
  const byId = new Map();
  for (const inst of included) {
    byId.set(inst.id, inst);
  }
  return [...byId.values()].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "ko"),
  );
}
