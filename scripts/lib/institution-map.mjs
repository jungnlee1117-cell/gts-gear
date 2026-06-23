/** extract-teacher-schedules.mjs 와 동일한 원명 매핑 */

export const DB_INSTITUTIONS = [
  "대치폴리", "수지폴리 본관", "수지폴리 별관", "광교폴리", "Sie.K",
  "프랜시스파커", "송파폴리", "관악SLP(서강)", "부천RISE", "리틀(=리틀어학원)",
  "텐즈아이어린이집", "성동ecc", "더차일드", "힘멜아카데미", "누비어린이집",
  "아띠어린이집", "아이뜰어린이집", "한신어린이집", "두리어린이집",
  "리비어어학원", "엘란어학원", "지니어스", "광명slp", "부개어린이집",
  "Play by GTS 삼성 센터", "송파 태그 멤버스", "용인 나비에로 야외수업",
];

export const INSTITUTION_RULES = [
  { re: /^개인수업|^개인레슨|^개인\s/i, db: "", personal: true },
  { re: /지니어스/i, db: "지니어스" },
  { re: /play by gts|삼성\s*센터/i, db: "Play by GTS 삼성 센터" },
  { re: /광명\s*slp/i, db: "광명slp" },
  { re: /부개어린이집/i, db: "부개어린이집" },
  { re: /송파\s*태그/i, db: "송파 태그 멤버스" },
  { re: /나비에로|nabiere/i, db: "용인 나비에로 야외수업" },
  { re: /수지폴리.*별관/i, db: "수지폴리 별관" },
  { re: /수지폴리.*본관|수지폴리어학원/i, db: "수지폴리 본관" },
  { re: /^수지폴리/i, db: "수지폴리 본관" },
  { re: /광교폴리/i, db: "광교폴리" },
  { re: /강동\s*sie\.?k|sie\.?k\s*\(?암사\)?|암사\s*sie\.?k/i, db: "Sie.K" },
  { re: /송파폴리/i, db: "송파폴리" },
  { re: /힘멜/i, db: "힘멜아카데미" },
  { re: /엘란/i, db: "엘란어학원" },
  { re: /리비어/i, db: "리비어어학원" },
  { re: /부천\s*라이즈|부천rise/i, db: "부천RISE" },
  { re: /관악\s*slp/i, db: "관악SLP(서강)" },
  { re: /마포\s*프랜시스|프랜시스\s*파커|프랜시스파커/i, db: "프랜시스파커" },
  { re: /대치폴리/i, db: "대치폴리" },
  { re: /더차일드/i, db: "더차일드" },
  { re: /한신/i, db: "한신어린이집" },
  { re: /두리/i, db: "두리어린이집" },
  { re: /아띠/i, db: "아띠어린이집" },
  { re: /아이뜰/i, db: "아이뜰어린이집" },
  { re: /누비/i, db: "누비어린이집" },
  { re: /텐즈/i, db: "텐즈아이어린이집" },
  { re: /성동\s*ecc/i, db: "성동ecc" },
  { re: /리틀/i, db: "리틀(=리틀어학원)" },
];

export function mapInstitution(raw) {
  const name = String(raw || "").trim().replace(/\s+/g, " ");
  if (!name || /^[-–—]$/.test(name)) return { db: "", personal: false };
  for (const rule of INSTITUTION_RULES) {
    if (rule.re.test(name)) {
      return { db: rule.db || "", personal: Boolean(rule.personal) };
    }
  }
  return { db: "", personal: false };
}

export function resolveInstitutionId(raw, institutionsByName) {
  if (!raw?.trim()) return null;
  const mapped = mapInstitution(raw);
  if (mapped.personal) return null;
  const dbName = mapped.db || raw.trim();
  const inst = institutionsByName.get(dbName);
  if (inst) return inst.id;
  for (const [name, row] of institutionsByName) {
    if (name.includes(dbName) || dbName.includes(name)) return row.id;
  }
  return null;
}
