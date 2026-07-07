import { AIRBRIDGE_SCRIPTS } from "./airbridgeScriptData.js";
import {
  findGame,
  findWarmupActivity,
  findWarmupSet,
  GEAR_INTRO_SCRIPT,
} from "./lessonScriptBuilderData.js";
import { getActivityGearScripts, getGearCatalogEntry } from "./gearScriptMeta.js";

function lineText(line, levelId) {
  if (line?.lines?.[levelId]) return line.lines[levelId];
  if (line?.text) return line.text;
  return "";
}

function formatDialogueLine(line, levelId) {
  const text = lineText(line, levelId).trim();
  if (!text) return "";
  const who = line.who === "teacher" ? "Teacher" : line.who === "kids" ? "Kids" : line.who || "";
  const action = line.action?.trim();
  const parts = [];
  if (who) parts.push(`[${who}]`);
  parts.push(text);
  if (action) parts.push(`(${action})`);
  return parts.join(" ");
}

function scriptBlockToText(script, levelId) {
  if (!script?.length) return "";
  return script
    .map(line => formatDialogueLine(line, levelId))
    .filter(Boolean)
    .join("\n");
}

function activityBlockTitle(block, fallback) {
  return block?.titleEn || block?.title || fallback || "";
}

/** 기존 교구 대본 데이터에서 본문 추출 (중복 데이터 생성 없음) */
export function extractGearLessonText(gearId, levelId = "foundation") {
  const catalog = getGearCatalogEntry(gearId);
  if (!catalog) return { title: "", text: "" };

  if (catalog.type === "sections") {
    const sections = AIRBRIDGE_SCRIPTS[levelId] || AIRBRIDGE_SCRIPTS.foundation || [];
    const chunks = sections.map(section => {
      const body = scriptBlockToText(section.script, levelId);
      if (!body) return "";
      const heading = section.tagLabel || section.stage || "";
      return heading ? `— ${heading} —\n${body}` : body;
    }).filter(Boolean);
    return {
      title: catalog.label,
      text: chunks.join("\n\n"),
    };
  }

  const data = getActivityGearScripts(gearId);
  if (!data) return { title: catalog.label, text: "" };

  const chunks = [];

  if (data.intro?.script) {
    const introTitle = activityBlockTitle(data.intro, "Opening");
    const introBody = scriptBlockToText(data.intro.script, levelId);
    if (introBody) chunks.push(`— ${introTitle} —\n${introBody}`);
  }

  for (const activity of data.activities || []) {
    const actTitle = activityBlockTitle(activity, `Activity ${activity.num || ""}`.trim());
    const pieces = [];
    if (activity.transitionIn?.[levelId]) {
      pieces.push(activity.transitionIn[levelId]);
    }
    const body = scriptBlockToText(activity.script, levelId);
    if (body) pieces.push(body);
    if (activity.transitionOut?.[levelId]) {
      pieces.push(activity.transitionOut[levelId]);
    }
    if (pieces.length) chunks.push(`— ${actTitle} —\n${pieces.join("\n")}`);
  }

  if (data.closing?.script) {
    const closingTitle = activityBlockTitle(data.closing, "Closing");
    const closingBody = scriptBlockToText(data.closing.script, levelId);
    if (closingBody) chunks.push(`— ${closingTitle} —\n${closingBody}`);
  }

  return {
    title: catalog.label,
    text: chunks.join("\n\n"),
  };
}

function moduleText(item) {
  if (!item) return "";
  if (item.text?.trim()) return item.text.trim();
  return item.placeholder || "";
}

/**
 * 선택 모듈을 순서대로 합쳐 완성 대본 생성
 * 1. 인사 & 워밍업 세트 → 2. 준비운동 → 3. 교구 소개 → 4. 교구 수업 → 5. 게임
 */
export function composeLessonScript({
  warmupSetId,
  warmupActivityId,
  gearId,
  gameId,
  levelId = "foundation",
}) {
  const sections = [];

  const warmupSet = findWarmupSet(warmupSetId);
  if (warmupSet) {
    sections.push({
      key: "warmup-set",
      order: 1,
      title: "1. 인사 & 워밍업",
      subtitle: warmupSet.label,
      parts: warmupSet.parts.map(part => ({
        label: part.label,
        text: part.text,
      })),
      text: warmupSet.parts.map(p => `【${p.label}】\n${p.text}`).join("\n\n"),
    });
  }

  const warmup = findWarmupActivity(warmupActivityId);
  if (warmup) {
    const text = moduleText(warmup);
    sections.push({
      key: "warmup-activity",
      order: 2,
      title: "2. 준비운동",
      subtitle: warmup.label,
      text,
    });
  }

  sections.push({
    key: "gear-intro",
    order: 3,
    title: "3. 교구 소개",
    subtitle: GEAR_INTRO_SCRIPT.label,
    text: GEAR_INTRO_SCRIPT.text,
  });

  if (gearId) {
    const gearLesson = extractGearLessonText(gearId, levelId);
    sections.push({
      key: "gear-lesson",
      order: 4,
      title: "4. 교구 수업",
      subtitle: gearLesson.title,
      text: gearLesson.text || "(선택한 교구의 대본이 아직 등록되지 않았습니다.)",
    });
  }

  const game = findGame(gameId);
  if (game) {
    sections.push({
      key: "game",
      order: 5,
      title: "5. 게임 활동",
      subtitle: game.label,
      text: moduleText(game),
    });
  }

  const fullText = sections
    .map(s => {
      if (s.parts?.length) {
        return `${s.title}\n${s.parts.map(p => `【${p.label}】\n${p.text}`).join("\n\n")}`;
      }
      return `${s.title}${s.subtitle ? ` · ${s.subtitle}` : ""}\n${s.text}`;
    })
    .join("\n\n────────────────────────\n\n");

  return { sections, fullText };
}
