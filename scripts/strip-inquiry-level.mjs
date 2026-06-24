#!/usr/bin/env node
/**
 * Inquiry 레벨 및 level3 스테이지 제거 (일회성 데이터 정리)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url);

function stripInquiryFromLines(text) {
  return text.replace(/,?\s*inquiry:\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\{[^}]*\})/g, "");
}

function stripInquiryFromCardLines(text) {
  return text.replace(/\n\s*inquiry:\s*\[[^\]]*\],?/g, "");
}

async function patchAirbridge() {
  const mod = await import(new URL("../src/airbridgeScriptData.js", import.meta.url).href);
  const { AIRBRIDGE_SCRIPTS } = mod;

  const filterSections = (sections) =>
    sections
      .filter(s => s.stage !== "level3" && !String(s.tagLabel || "").includes("L2→L3"))
      .map(s => ({
        ...s,
        tagLabel: s.tagLabel === "Level 1" ? "Foundation"
          : s.tagLabel === "Level 2" ? "Interactive"
          : s.tagLabel,
      }));

  const foundation = filterSections(AIRBRIDGE_SCRIPTS.foundation);
  const interactive = filterSections(AIRBRIDGE_SCRIPTS.interactive);

  const header = `// GTS 에어브릿지 영어 수업 대본
// Foundation / Interactive 2단계 레벨 시스템

export const GEAR_LABEL = "에어브릿지";

export const LEVELS = [
  {
    id: "foundation",
    label: "Foundation English",
    desc: "영어 처음 접하는 아이들 — 한국어 50% + 핵심 단어만 영어",
    color: "#059669",
    bg: "#E1F5EE",
  },
  {
    id: "interactive",
    label: "Interactive English",
    desc: "영어 조금 아는 아이들 — 영어 위주 + 단어→짧은 문장 유도",
    color: "#d97706",
    bg: "#FAEEDA",
  },
];

export const STAGES = [
  { tag: "intro", label: "교구소개" },
  { tag: "level1", label: "Foundation" },
  { tag: "level2", label: "Interactive" },
  { tag: "closing", label: "마무리" },
];

export const AIRBRIDGE_SCRIPTS = {
  foundation: ${JSON.stringify(foundation, null, 2)},
  interactive: ${JSON.stringify(interactive, null, 2)},
};

export const scripts = [
  ...AIRBRIDGE_SCRIPTS.foundation,
  ...AIRBRIDGE_SCRIPTS.interactive,
];
`;

  writeFileSync(new URL("src/airbridgeScriptData.js", ROOT), header);
  console.log("airbridgeScriptData.js updated");
}

function patchActivityFile(relPath) {
  let text = readFileSync(new URL(relPath, ROOT), "utf8");
  text = stripInquiryFromLines(text);
  text = stripInquiryFromCardLines(text);
  writeFileSync(new URL(relPath, ROOT), text);
  console.log(`${relPath} updated`);
}

await patchAirbridge();
for (const f of [
  "src/balanceBoardScriptData.js",
  "src/airClimbingMatScriptData.js",
  "src/brickScriptData.js",
  "src/bilboScriptData.js",
]) {
  patchActivityFile(f);
}
