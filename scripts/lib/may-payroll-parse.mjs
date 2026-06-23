import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mapInstitution } from "./institution-map.mjs";

const DATE_RE = /^(\d{4}-05-\d{2}|5\/\d{1,2}|5\.\d{1,2})$/;
const PAY_TYPES = new Set(["정규", "방과후", "가정방문", "센터", "센터보조"]);

function parseMayDate(raw, year = 2026) {
  const s = String(raw || "").trim();
  if (/^\d{4}-05-\d{2}$/.test(s)) return s;
  const m = s.match(/^5[/.](\d{1,2})$/);
  if (m) return `${year}-05-${String(Number(m[1])).padStart(2, "0")}`;
  return null;
}

function parseMinutes(raw) {
  if (raw == null || raw === "") return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** "5월 수업시수" 섹션 탐색 및 파싱 */
export function parseMayHoursFromGrid(grid, teacherName, year = 2026) {
  if (!grid?.length) return { rows: [], sectionRow: -1, note: "그리드 없음" };

  let sectionRow = -1;
  for (let r = 0; r < grid.length; r++) {
    const a = String(grid[r][0] ?? "").trim();
    if (/5월\s*수업\s*시수/i.test(a) || a === "5월 수업시수" || /^5월$/.test(a)) {
      sectionRow = r;
      break;
    }
  }

  if (sectionRow < 0) {
    return { rows: [], sectionRow: -1, note: "5월 수업시수 섹션 없음" };
  }

  const headerRow = grid[sectionRow + 1] ?? [];
  const headerText = headerRow.join(" ").toLowerCase();

  // 형식 A: 날짜 | 원 | 정규(분) | 방과후(분) ...
  const colDate = headerRow.findIndex(h => /날짜|일자|date/i.test(String(h)));
  const colInst = headerRow.findIndex(h => /학원|원/i.test(String(h)));
  const colRegular = headerRow.findIndex(h => /정규/i.test(String(h)));
  const colAfter = headerRow.findIndex(h => /방과후/i.test(String(h)));
  const colPersonal = headerRow.findIndex(h => /개인/i.test(String(h)));

  const rows = [];

  if (colDate >= 0 && (colRegular >= 0 || colAfter >= 0 || colPersonal >= 0)) {
    for (let r = sectionRow + 2; r < grid.length; r++) {
      const line = grid[r];
      const dateStr = parseMayDate(line[colDate], year);
      if (!dateStr) {
        if (rows.length && !String(line[colDate] ?? "").trim()) break;
        continue;
      }
      const instRaw = colInst >= 0 ? line[colInst] : "";
      const mapped = mapInstitution(instRaw);
      const regular = colRegular >= 0 ? parseMinutes(line[colRegular]) : 0;
      const after = colAfter >= 0 ? parseMinutes(line[colAfter]) : 0;
      const personal = colPersonal >= 0 ? parseMinutes(line[colPersonal]) : 0;

      if (regular > 0) {
        rows.push({
          teacher: teacherName,
          class_date: dateStr,
          institution_name: mapped.personal ? "" : (mapped.db || instRaw),
          pay_type: "정규",
          minutes: regular,
          source: "sheet",
        });
      }
      if (after > 0) {
        rows.push({
          teacher: teacherName,
          class_date: dateStr,
          institution_name: mapped.db || instRaw,
          pay_type: "방과후",
          minutes: after,
          source: "sheet",
        });
      }
      if (personal > 0) {
        rows.push({
          teacher: teacherName,
          class_date: dateStr,
          institution_name: "",
          pay_type: "정규",
          minutes: personal,
          note: "개인레슨",
          source: "sheet",
        });
      }
    }
    return { rows, sectionRow, note: `형식A (${rows.length}건)` };
  }

  // 형식 B: 첫 열 날짜, 이후 열이 원별 정규/방과후
  for (let r = sectionRow + 1; r < Math.min(sectionRow + 80, grid.length); r++) {
    const line = grid[r];
    const dateStr = parseMayDate(line[0], year);
    if (!dateStr) continue;
    for (let c = 1; c < line.length; c += 1) {
      const header = String(headerRow[c] ?? grid[sectionRow][c] ?? "").trim();
      if (!header) continue;
      const mins = parseMinutes(line[c]);
      if (mins <= 0) continue;
      const mapped = mapInstitution(header);
      let payType = "정규";
      if (/방과후/i.test(header)) payType = "방과후";
      else if (/가정/i.test(header)) payType = "가정방문";
      else if (/센터/i.test(header)) payType = "센터";
      rows.push({
        teacher: teacherName,
        class_date: dateStr,
        institution_name: mapped.personal ? "" : (mapped.db || header),
        pay_type: payType,
        minutes: mins,
        source: "sheet",
      });
    }
  }

  return {
    rows,
    sectionRow,
    note: rows.length ? `형식B (${rows.length}건)` : `섹션은 있으나 파싱 실패 (header: ${headerText.slice(0, 60)})`,
  };
}

export function parseMayCsvFile(filePath, teacherName) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
  if (!lines.length) return [];

  const header = lines[0].split(",").map(h => h.trim());
  const idx = (name) => header.indexOf(name);

  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map(c => c.trim());
    const get = (name) => cols[idx(name)] ?? "";
    const dateStr = parseMayDate(get("class_date") || get("date") || get("날짜"));
    const minutes = parseMinutes(get("minutes") || get("분"));
    const payType = get("pay_type") || get("수업유형") || "정규";
    if (!dateStr || minutes <= 0) continue;
    if (!PAY_TYPES.has(payType)) continue;
    rows.push({
      teacher: teacherName,
      class_date: dateStr,
      institution_name: get("institution_name") || get("institution") || get("원명") || "",
      pay_type: payType,
      minutes,
      note: get("note") || get("메모") || null,
      source: "csv",
    });
  }
  return rows;
}

export function loadCsvDir(csvDir, teacherNames) {
  const rows = [];
  if (!existsSync(csvDir)) return rows;

  for (const name of teacherNames) {
    const path = join(csvDir, `${name}.csv`);
    if (existsSync(path)) {
      rows.push(...parseMayCsvFile(path, name));
      continue;
    }
    const alt = join(csvDir, `${name.replace(/\s/g, "")}.csv`);
    if (existsSync(alt)) rows.push(...parseMayCsvFile(alt, name));
  }

  // may-payroll.csv 단일 파일
  const combined = join(csvDir, "may-payroll.csv");
  if (existsSync(combined)) {
    const text = readFileSync(combined, "utf8");
    const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
    const header = lines[0]?.split(",").map(h => h.trim()) ?? [];
    const teacherIdx = header.indexOf("teacher") >= 0 ? header.indexOf("teacher") : header.indexOf("강사");
    for (const line of lines.slice(1)) {
      const cols = line.split(",").map(c => c.trim());
      const tName = cols[teacherIdx];
      if (!teacherNames.includes(tName)) continue;
      const tmp = parseMayCsvFile(`teacher,class_date,institution_name,pay_type,minutes\n${line}`, tName);
      rows.push(...tmp);
    }
  }

  return rows;
}

export function probeTeacherGrids(grids) {
  const report = [];
  for (const [name, { grid, error }] of Object.entries(grids)) {
    if (error) {
      report.push({ teacher: name, status: "error", detail: error, note: error });
      continue;
    }
    const parsed = parseMayHoursFromGrid(grid, name);
    report.push({
      teacher: name,
      status: parsed.rows.length ? "ok" : "missing",
      sectionRow: parsed.sectionRow,
      rows: parsed.rows.length,
      note: parsed.note,
    });
  }
  return report;
}
