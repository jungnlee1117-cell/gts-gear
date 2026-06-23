#!/usr/bin/env node
/**
 * Google Sheets 2026 선생님 스케줄 → teacher_assignments.csv / weekly_schedule.csv
 *
 *   node scripts/extract-teacher-schedules.mjs
 *   node scripts/extract-teacher-schedules.mjs --dry-run
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SPREADSHEET_ID = "1bxhtUJzi8eNKssEq8DbVqqsj24Fad681PTH0Yv6LB-Q";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "supabase/data");

const TEACHER_TABS = [
  "어욱진", "김종현", "오주영", "윤한경", "공성주", "안소연",
  "공다연", "김민욱", "김하원", "서은총", "레이첼", "마이크",
];

const DB_INSTITUTIONS = [
  "대치폴리", "수지폴리 본관", "수지폴리 별관", "광교폴리", "Sie.K",
  "프랜시스파커", "송파폴리", "관악SLP(서강)", "부천RISE", "리틀(=리틀어학원)",
  "텐즈아이어린이집", "성동ecc", "더차일드", "힘멜아카데미", "누비어린이집",
  "아띠어린이집", "아이뜰어린이집", "한신어린이집", "두리어린이집",
  "리비어어학원", "엘란어학원", "지니어스", "광명slp", "부개어린이집",
  "Play by GTS 삼성 센터", "송파 태그 멤버스", "용인 나비에로 야외수업",
];

const DAY_FROM_HEADER = {
  mon: 1, monday: 1, "mon (월)": 1, "월": 1,
  tue: 2, tuesday: 2, "tue (화)": 2, "화": 2,
  wed: 3, wednesday: 3, "wed (수)": 3, "수": 3,
  thu: 4, thursday: 4, "thu (목)": 4, "목": 4,
  fri: 5, friday: 5, "fri (금)": 5, "금": 5,
  sat: 6, "sat (토)": 6, "토": 6,
  sun: 0, "sun (일)": 0, "일": 0,
};

const INSTITUTION_RULES = [
  { re: /^개인수업/i, db: "", personal: true },
  { re: /지니어스/i, db: "지니어스" },
  { re: /play by gts|삼성\s*센터/i, db: "Play by GTS 삼성 센터" },
  { re: /광명\s*slp/i, db: "광명slp" },
  { re: /부개어린이집/i, db: "부개어린이집" },
  { re: /송파\s*태그/i, db: "송파 태그 멤버스" },
  { re: /나비에로|nabiere/i, db: "용인 나비에로 야외수업" },
  { re: /수지폴리.*별관/i, db: "수지폴리 별관" },
  { re: /수지폴리.*본관/i, db: "수지폴리 본관" },
  { re: /^수지폴리/i, db: "수지폴리 본관", note: "본관/별관 미구분" },
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

const TIME_RE = /(\d{1,2})\s*:\s*(\d{2})\s*[-~–]\s*(\d{1,2})\s*:\s*(\d{2})/g;

function normTime(h, m) {
  return `${String(Number(h)).padStart(2, "0")}:${String(Number(m)).padStart(2, "0")}`;
}

function parseDayHeader(cell) {
  if (!cell) return null;
  const s = String(cell).trim().toLowerCase();
  if (DAY_FROM_HEADER[s] != null) return DAY_FROM_HEADER[s];
  const m = s.match(/^(mon|tue|wed|thu|fri|sat|sun)/i);
  if (m) return DAY_FROM_HEADER[m[1].toLowerCase()];
  const kr = s.match(/\(([월화수목금토일])\)/);
  if (kr) return DAY_FROM_HEADER[kr[1]];
  return null;
}

function mapInstitution(raw) {
  const name = String(raw || "").trim().replace(/\s+/g, " ");
  if (!name || /^[-–—]$/.test(name)) return { db: "", sheet: name, matched: false };
  if (/가정방문/i.test(name)) return { db: "", sheet: "가정방문", matched: true, isHome: true };

  for (const rule of INSTITUTION_RULES) {
    if (rule.re.test(name)) {
      if (rule.personal) {
        return { db: "", sheet: name, matched: true, personal: true };
      }
      const inDb = DB_INSTITUTIONS.includes(rule.db);
      return { db: rule.db, sheet: name, matched: inDb, note: rule.note };
    }
  }

  if (/센터|play by gts|야외|나비에로|nabiere|엘리트/i.test(name)) {
    return { db: "", sheet: name, matched: false, isCenter: true };
  }
  return { db: "", sheet: name, matched: false };
}

function extractAfternoonSlots(text) {
  if (!text) return [];
  const slots = [];
  const re = new RegExp(TIME_RE.source, "g");
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const sh = Number(m[1]);
    const eh = Number(m[3]);
    if (sh >= 1 && sh <= 7 && eh >= 1 && eh <= 7) {
      slots.push({ start: normTime(sh + 12, m[2]), end: normTime(eh + 12, m[4]) });
    }
  }
  return slots;
}

function extractTimes(text) {
  if (!text) return [];
  const slots = [];
  let m;
  const re = new RegExp(TIME_RE.source, "g");
  while ((m = re.exec(String(text))) !== null) {
    const lineStart = String(text).lastIndexOf("\n", m.index) + 1;
    const lineEnd = String(text).indexOf("\n", m.index);
    const line = String(text).slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (/점심|간식|점시/i.test(line)) continue;
    slots.push({ start: normTime(m[1], m[2]), end: normTime(m[3], m[4]) });
  }
  return slots;
}

function parseStructuredSheet(rows, teacherName) {
  const entries = [];
  const getCell = (r, c) => {
    const row = rows[r];
    if (!row?.c?.[c]) return "";
    return row.c[c].v ?? "";
  };
  const label = (r) => String(getCell(r, 0)).trim();

  let dayRow = -1;
  for (let r = 0; r < rows.length; r++) {
    if (label(r) === "요일") { dayRow = r; break; }
  }
  if (dayRow < 0) return null;

  const dayCols = [];
  for (let c = 1; c < 30; c += 2) {
    const d = parseDayHeader(getCell(dayRow, c));
    if (d != null) dayCols.push({ col: c, day: d });
  }

  let section = "정규";
  for (let r = dayRow + 1; r < rows.length; r++) {
    const l0 = label(r);
    if (/After-school|방과후/i.test(l0)) { section = "방과후"; continue; }
    if (/이외 스케줄|주말|공지|Regular Class/i.test(l0) && l0 !== "학원 이름") continue;

    if (l0 === "학원 이름") {
      // 주말 등 시간표 없이 원만 있는 경우 → assignments용
      for (const { col, day } of dayCols) {
        const instRaw = getCell(r, col);
        if (!instRaw || String(instRaw).trim().length < 2) continue;
        const timeBelow = getCell(r + 3, col); // rough: 수업 시간 row often +3
        if (String(timeBelow || "").match(TIME_RE)) continue;
        const mapped = mapInstitution(instRaw);
        if (mapped.personal) continue;
        if (mapped.isHome) continue;
        const classType = mapped.isHome ? "가정방문"
          : /야외/i.test(String(instRaw)) ? "센터"
            : mapped.isCenter ? "센터" : section;
        entries.push({
          teacher: teacherName, day, classType,
          institutionSheet: mapped.sheet, institutionDb: mapped.db,
          matched: mapped.matched || mapped.isCenter, mapNote: mapped.note,
          assignmentOnly: true,
        });
      }
      continue;
    }

    if (l0.startsWith("수업 시간")) {
      // pair with most recent institution row for same section — scan upward for 학원 이름 in this section
      let instRow = r - 1;
      while (instRow > dayRow && label(instRow) !== "학원 이름") instRow--;
      if (label(instRow) !== "학원 이름") continue;

      for (const { col, day } of dayCols) {
        const timeText = getCell(r, col);
        const instRaw = getCell(instRow, col);
        if (!timeText || !instRaw) continue;
        const mapped = mapInstitution(instRaw);
        const classType = mapped.personal
          ? section
          : mapped.isHome ? "가정방문"
            : /야외/i.test(String(instRaw)) ? "센터"
              : mapped.isCenter ? "센터" : section;
        const times = extractTimes(timeText);
        for (const t of times) {
          entries.push({
            teacher: teacherName,
            day,
            classType,
            institutionSheet: mapped.sheet || String(instRaw).trim(),
            institutionDb: mapped.db,
            matched: mapped.matched || mapped.isHome,
            personal: mapped.personal,
            start: t.start,
            end: t.end,
            isSlot: true,
          });
        }
      }
    }
  }
  return entries;
}

function parseFlattenedCsv(csvText, teacherName) {
  const rows = parseCsvRows(csvText);
  if (!rows[0]) return [];
  const entries = [];
  const row0 = rows[0];

  for (let col = 1; col < row0.length; col += 2) {
    const block = row0[col];
    if (!block || block.length < 20) continue;

    const dayM = block.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\(([월화수목금토일])\)/i);
    if (!dayM) continue;
    const day = DAY_FROM_HEADER[dayM[1].toLowerCase()];

    let instPart = block.slice(dayM[0].length).trim();
    const addrIdx = instPart.search(/\s(서울|경기)/);
    if (addrIdx > 0) instPart = instPart.slice(0, addrIdx).trim();
    instPart = instPart.replace(/\s*정규\s*$/i, "").trim();

    const mappedPrimary = mapInstitution(instPart);
    const allTimes = extractTimes(block);

    const afterSchoolMarker = block.search(/(\d+\s*분\s*\d+\s*타임[\s\S]{0,40}?(송파폴리|강동|SIE|힘멜))/i);
    const afterText = afterSchoolMarker > 0 ? block.slice(afterSchoolMarker) : block;
    let afterTimes = extractAfternoonSlots(afterText);
    let regularTimes;

    // 1~7시 표기(3:00 등)는 방과후 — 정규에서 제외
    regularTimes = allTimes.filter(t => {
      const h = Number(t.start.split(":")[0]);
      if (h >= 1 && h <= 7) return false;
      return !afterTimes.some(a => a.start === t.start && a.end === t.end);
    });
    for (const t of allTimes) {
      const h = Number(t.start.split(":")[0]);
      if (h >= 1 && h <= 7) {
        const pm = { start: normTime(h + 12, t.start.split(":")[1]), end: normTime(Number(t.end.split(":")[0]) + 12, t.end.split(":")[1]) };
        if (!afterTimes.some(a => a.start === pm.start && a.end === pm.end)) afterTimes.push(pm);
      }
    }

    // 가정방문
    if (/가정방문/i.test(block)) {
      const homeTimes = extractTimes(block.split(/가정방문/i)[1] || "");
      for (const t of homeTimes) {
        entries.push({ teacher: teacherName, day, classType: "가정방문", institutionSheet: "가정방문", institutionDb: "", matched: true, ...t, isSlot: true });
      }
    }

    for (const t of regularTimes) {
      if (/가정방문/.test(block) && Number(t.start.split(":")[0]) >= 15 && mappedPrimary.db === "힘멜아카데미") {
        // Wed home visit handled separately
        continue;
      }
      entries.push({
        teacher: teacherName, day, classType: "정규",
        institutionSheet: mappedPrimary.sheet, institutionDb: mappedPrimary.db,
        matched: mappedPrimary.matched, ...t, isSlot: true,
      });
    }

    const afterInst = block.match(/(\d+\s*분\s*\d+\s*타임\s*)(.+?)(?=\s\d{1,2}:\d{2})/isu);
    const afterMapped = afterInst ? mapInstitution(afterInst[2]) : mappedPrimary;
    for (const t of afterTimes) {
      entries.push({
        teacher: teacherName, day, classType: "방과후",
        institutionSheet: afterMapped.sheet || mappedPrimary.sheet,
        institutionDb: afterMapped.db || mappedPrimary.db,
        matched: afterMapped.matched || mappedPrimary.matched,
        ...t, isSlot: true,
      });
    }
  }
  return entries;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function fetchSheetJson(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const raw = await res.text();
  const m = raw.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
  if (!m) throw new Error(`JSON parse failed: ${sheetName}`);
  return JSON.parse(m[1]).table.rows || [];
}

async function fetchSheetCsv(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  return res.text();
}

function dayLabel(d) {
  return ["일", "월", "화", "수", "목", "금", "토"][d] ?? String(d);
}

function csvEscape(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const allEntries = [];
  const unmatchedInst = new Map();

  for (const teacher of TEACHER_TABS) {
    let entries = null;
    try {
      const rows = await fetchSheetJson(teacher);
      entries = parseStructuredSheet(rows, teacher);
    } catch (e) {
      console.warn(`${teacher}: JSON failed`, e.message);
    }

    if (!entries?.length) {
      const csv = await fetchSheetCsv(teacher);
      entries = parseFlattenedCsv(csv, teacher);
      console.log(`${teacher}: flattened CSV parser (${entries.length} slots)`);
    } else {
      console.log(`${teacher}: structured JSON parser (${entries.length} entries)`);
    }

    allEntries.push(...entries);
  }

  const weeklyRows = [];
  const personalRows = [];
  const assignmentSet = new Set();
  const assignmentRows = [];

  for (const e of allEntries) {
    if (e.personal || /^개인수업/i.test(e.institutionSheet || "")) {
      if (e.isSlot && e.start && e.end) {
        personalRows.push({
          강사명: e.teacher,
          레슨명: e.institutionSheet,
          요일: dayLabel(e.day),
          요일번호: e.day,
          수업유형: e.classType,
          시작시간: e.start,
          종료시간: e.end,
        });
      }
      continue;
    }

    if (e.assignmentOnly) {
      if (e.personal) continue;
      if (!e.institutionDb) continue;
      const instKey = e.institutionDb || e.institutionSheet || "(없음)";
      const aKey = `${e.teacher}|${instKey}|${e.classType}`;
      if (!assignmentSet.has(aKey)) {
        assignmentSet.add(aKey);
        assignmentRows.push({
          강사명: e.teacher,
          원명: e.institutionDb || e.institutionSheet || instKey,
          원명_시트: e.institutionSheet || instKey,
          수업유형: e.classType,
          matched: e.matched,
          비고: (e.mapNote || "") + (e.assignmentOnly ? " (시간 미기재)" : ""),
        });
      }
      continue;
    }

    if (!e.isSlot || !e.start || !e.end) continue;
    if (e.personal) continue;
    if (!e.institutionDb) continue;

    weeklyRows.push({
      강사명: e.teacher,
      원명: e.institutionDb || e.institutionSheet,
      원명_시트: e.institutionSheet,
      요일: dayLabel(e.day),
      요일번호: e.day,
      수업유형: e.classType,
      시작시간: e.start,
      종료시간: e.end,
      matched: e.matched,
    });

    const instKey = e.institutionDb || e.institutionSheet || "(없음)";
    const aKey = `${e.teacher}|${instKey}|${e.classType}`;
    if (!e.institutionDb) continue;
    if (!assignmentSet.has(aKey)) {
      assignmentSet.add(aKey);
      assignmentRows.push({
        강사명: e.teacher,
        원명: e.institutionDb || e.institutionSheet || instKey,
        원명_시트: e.institutionSheet || instKey,
        수업유형: e.classType,
        matched: e.matched,
        비고: e.mapNote || "",
      });
    }

    if (e.institutionSheet && !e.matched && !e.personal && e.classType !== "가정방문") {
      unmatchedInst.set(e.institutionSheet, e.institutionDb || "(DB 없음)");
    }
  }

  personalRows.sort((a, b) =>
    a.강사명.localeCompare(b.강사명, "ko")
    || a.요일번호 - b.요일번호
    || a.시작시간.localeCompare(b.시작시간),
  );

  weeklyRows.sort((a, b) =>
    a.강사명.localeCompare(b.강사명, "ko")
    || a.요일번호 - b.요일번호
    || a.시작시간.localeCompare(b.시작시간),
  );
  assignmentRows.sort((a, b) =>
    a.강사명.localeCompare(b.강사명, "ko") || a.원명_시트.localeCompare(b.원명_시트, "ko"),
  );

  const weeklyHeader = ["강사명", "원명", "요일", "수업유형", "시작시간", "종료시간"];
  const weeklyCsv = [
    weeklyHeader.join(","),
    ...weeklyRows.map(r => [
      r.강사명, r.원명, r.요일, r.수업유형, r.시작시간, r.종료시간,
    ].map(csvEscape).join(",")),
  ].join("\n");

  const assignHeader = ["강사명", "원명", "수업유형"];
  const assignCsv = [
    assignHeader.join(","),
    ...assignmentRows.map(r => [r.강사명, r.원명, r.수업유형].map(csvEscape).join(",")),
  ].join("\n");

  const personalHeader = ["강사명", "레슨명", "요일", "수업유형", "시작시간", "종료시간"];
  const personalCsv = [
    personalHeader.join(","),
    ...personalRows.map(r => [
      r.강사명, r.레슨명, r.요일, r.수업유형, r.시작시간, r.종료시간,
    ].map(csvEscape).join(",")),
  ].join("\n");

  const matchReport = [
    "# institution 매칭 리포트",
    "",
    `## DB 등록 원 (${DB_INSTITUTIONS.length}개)`,
    ...DB_INSTITUTIONS.map(n => `- ${n}`),
    "",
    "## 시트 원명 → DB (자동 매핑 규칙)",
    ...INSTITUTION_RULES.map(r => `- \`${r.re}\` → ${r.db}${r.note ? ` (${r.note})` : ""}`),
    "",
    "## 미매칭 시트 원명",
    ...[...unmatchedInst.keys()].sort().map(k => `- ${k}`),
    "",
    "## 개인수업 (institutions·배정 제외)",
    "→ `personal_schedule.csv` — payroll_entries 입력 시 institution_id=NULL",
    ...personalRows.map(r => `- ${r.강사명} / ${r.레슨명} / ${r.요일} ${r.시작시간}-${r.종료시간}`),
    "",
  ].join("\n");

  if (!dryRun) {
    writeFileSync(join(OUT_DIR, "weekly_schedule.csv"), weeklyCsv + "\n", "utf8");
    writeFileSync(join(OUT_DIR, "teacher_assignments.csv"), assignCsv + "\n", "utf8");
    writeFileSync(join(OUT_DIR, "personal_schedule.csv"), personalCsv + "\n", "utf8");
    writeFileSync(join(OUT_DIR, "institution_match_report.md"), matchReport, "utf8");
  }

  console.log("\n========== 요약 ==========");
  console.log(`weekly_schedule: ${weeklyRows.length} 슬롯`);
  console.log(`teacher_assignments: ${assignmentRows.length} 행`);
  console.log(`personal_schedule: ${personalRows.length} 슬롯 (institution_id 없음)`);
  console.log(`미매칭 원명: ${unmatchedInst.size}종`);
  if (unmatchedInst.size) {
    console.log([...unmatchedInst.keys()].map(k => `  - ${k}`).join("\n"));
  }
  if (!dryRun) {
    console.log(`\n저장: supabase/data/weekly_schedule.csv`);
    console.log(`      supabase/data/teacher_assignments.csv`);
    console.log(`      supabase/data/personal_schedule.csv`);
    console.log(`      supabase/data/institution_match_report.md`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
