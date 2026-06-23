/**
 * Google Docs 영어체육 월간 계획안 텍스트 파서
 */

const MONTH_EN = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

export function yearMonthFromSchoolMonth(monthNum, startYear = 2026) {
  const y = monthNum >= 3 ? startYear : startYear + 1;
  return `${y}-${String(monthNum).padStart(2, "0")}`;
}

function detectMonth(sectionText) {
  const ko = sectionText.match(/(\d{1,2})월\s*영어체육/);
  if (ko) return Number(ko[1]);
  const en = sectionText.match(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+LESSON\s+PLAN/i);
  if (en) return MONTH_EN[en[1].toUpperCase()];
  return null;
}

const MONTH_NAMES = Object.keys(MONTH_EN).join("|");

function splitMonthSections(text) {
  const cleaned = text.replace(/^\uFEFF/, "");
  const re = new RegExp(
    `(?=(?:^|\\n)(?:\\d{1,2}월\\s*영어체육|(?:${MONTH_NAMES})\\s+LESSON\\s+PLAN))`,
    "gim",
  );
  const markers = [...cleaned.matchAll(re)];
  const sections = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = markers[i + 1]?.index ?? cleaned.length;
    const chunk = cleaned.slice(start, end);
    const month = detectMonth(chunk);
    if (month) sections.push({ month, text: chunk });
  }
  return sections;
}

function cleanLine(s) {
  return String(s || "").replace(/\t/g, " ").replace(/\s+/g, " ").trim();
}

function isActivityLine(line) {
  return /^\d+\.\s/.test(line);
}

function isNoiseLine(line) {
  if (!line) return true;
  if (/^Week\s*$/i.test(line)) return true;
  if (/^(Equipment|Activity|Key Expression|Key Expressions)$/i.test(line)) return true;
  if (/^✅|^Age:|^📌|^Goal:/i.test(line)) return true;
  if (/^Tab \d+$/i.test(line)) return true;
  return false;
}

function parseWeekBlock(block) {
  const header = block.match(/Week\s*(\d+)\s*:?\s*(.*)?/i);
  if (!header) return null;
  const week_number = Number(header[1]);
  let rest = block.slice(header.index + header[0].length);
  const lines = rest.split("\n").map(cleanLine).filter(l => !isNoiseLine(l));

  let equipment_name_en = cleanLine(header[2] || "");
  const activityLines = [];
  const keyLines = [];
  let phase = equipment_name_en ? "activity" : "equipment";

  for (const line of lines) {
    if (/^Week\s*\d+/i.test(line)) break;
    if (/📌|subject to change/i.test(line)) continue;

    if (isActivityLine(line)) {
      phase = "activity";
      activityLines.push(line);
      continue;
    }
    if (phase === "equipment" && line && !equipment_name_en) {
      equipment_name_en = line.replace(/^["“]|["”]$/g, "").trim();
      phase = "body";
      continue;
    }
    if (phase === "equipment" && line && equipment_name_en) {
      phase = "body";
    }
    if (phase === "body" && activityLines.length === 0 && line.length > 0) {
      activityLines.push(line);
      phase = "key";
      continue;
    }
    if (line) keyLines.push(line.replace(/^["“]|["”]$/g, "").trim());
  }

  equipment_name_en = equipment_name_en.replace(/\s+/g, " ").trim();
  if (/📌|subject to change|^Tab \d+$/i.test(equipment_name_en)) return null;
  if (!equipment_name_en && activityLines.length === 0 && keyLines.length === 0) return null;

  return {
    week_number,
    equipment_name_en: equipment_name_en || "(미지정)",
    activity_description: activityLines.join("\n"),
    key_expressions: keyLines.join("\n"),
  };
}

function parseMonthSection(sectionText) {
  const parts = sectionText.split(/(?=Week\s*\d+)/i);
  const weeks = [];
  for (const part of parts) {
    const row = parseWeekBlock(part);
    if (row) weeks.push(row);
  }
  return weeks;
}

export function parseLessonPlanDocument(text, startYear = 2026) {
  const sections = splitMonthSections(text);
  const byMonth = new Map();

  for (const { month, text: chunk } of sections) {
    const weeks = parseMonthSection(chunk).filter(w =>
      w.equipment_name_en && w.equipment_name_en !== "(미지정)"
      || w.activity_description || w.key_expressions,
    );
    const prev = byMonth.get(month);
    if (!prev || weeks.length > prev.weeks.length) {
      byMonth.set(month, { month, weeks });
    }
  }

  const rows = [];
  const weekSlot = new Map();
  for (const { month, weeks } of byMonth.values()) {
    const year_month = `${yearMonthFromSchoolMonth(month, startYear)}-01`;
    for (const week of weeks) {
      const slot = `${year_month}|${week.week_number}`;
      const prev = weekSlot.get(slot);
      if (prev && (prev.activity_description?.length || 0) > (week.activity_description?.length || 0)) continue;
      weekSlot.set(slot, { year_month, ...week });
    }
  }
  for (const row of weekSlot.values()) rows.push(row);
  return rows.sort((a, b) =>
    a.year_month.localeCompare(b.year_month) || a.week_number - b.week_number,
  );
}

export const GOOGLE_DOC_ID = "1lyZjS9Y_cky4F2tb9Kh-kWDlycB-ddAvxnUEyVSq7J8";

export async function downloadLessonPlanText(docId = GOOGLE_DOC_ID) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`문서 다운로드 실패: ${res.status}`);
  return res.text();
}
