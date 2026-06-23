import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SPREADSHEET_ID = "1bxhtUJzi8eNKssEq8DbVqqsj24Fad681PTH0Yv6LB-Q";

function colNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function parseSharedStrings(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    out.push([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)]
      .map(x => x[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
      .join(""));
  }
  return out;
}

function parseWorkbookSheetMap(workbookXml, relsXml) {
  const ridToFile = Object.fromEntries(
    [...relsXml.matchAll(/Id="([^"]+)"[^>]*Target="worksheets\/([^"]+)"/g)].map(m => [m[1], m[2]]),
  );
  const map = {};
  for (const m of workbookXml.matchAll(/name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    map[m[1]] = ridToFile[m[2]];
  }
  return map;
}

export async function downloadSpreadsheetXlsx() {
  const dir = mkdtempSync(join(tmpdir(), "gts-sheet-"));
  const xlsx = join(dir, "sched.xlsx");
  execSync(
    `curl -sL "https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx" -o "${xlsx}"`,
    { stdio: "pipe" },
  );
  execSync(`unzip -o -q "${xlsx}" -d "${dir}/x"`, { stdio: "pipe" });
  return { dir, base: join(dir, "x") };
}

export function cleanupSpreadsheetDir(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

export function loadSheetGrid(baseDir, sheetFile, sharedStrings) {
  const xml = readFileSync(join(baseDir, "xl/worksheets", sheetFile), "utf8");
  const rows = {};
  let maxRow = 0;
  let maxCol = 0;

  for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<f>([^<]*)<\/f>)?(?:<v>([^<]*)<\/v>)?/g)) {
    const r = Number(m[2]) - 1;
    const c = colNum(m[1]);
    let val = m[5] ?? "";
    if (/t="s"/.test(m[3]) && val !== "") val = sharedStrings[Number(val)] ?? val;
    if (m[4] && !val) val = `=${m[4]}`;
    rows[r] ??= {};
    rows[r][c] = String(val);
    maxRow = Math.max(maxRow, r);
    maxCol = Math.max(maxCol, c);
  }

  const grid = [];
  for (let r = 0; r <= maxRow; r++) {
    const line = [];
    for (let c = 0; c <= maxCol; c++) line.push(rows[r]?.[c] ?? "");
    grid.push(line);
  }
  return grid;
}

export async function loadAllTeacherGrids(teacherNames) {
  const { dir, base } = await downloadSpreadsheetXlsx();
  const sharedStrings = parseSharedStrings(readFileSync(join(base, "xl/sharedStrings.xml"), "utf8"));
  const sheetMap = parseWorkbookSheetMap(
    readFileSync(join(base, "xl/workbook.xml"), "utf8"),
    readFileSync(join(base, "xl/_rels/workbook.xml.rels"), "utf8"),
  );

  const out = {};
  for (const name of teacherNames) {
    const file = sheetMap[name];
    if (!file) {
      out[name] = { grid: null, error: "탭 없음" };
      continue;
    }
    out[name] = { grid: loadSheetGrid(base, file, sharedStrings), error: null };
  }
  cleanupSpreadsheetDir(dir);
  return out;
}
