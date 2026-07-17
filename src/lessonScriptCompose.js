import { AIRBRIDGE_SCRIPTS } from "./airbridgeScriptData.js";
import { getDifficultyText } from "./lessonScriptDifficulty.js";
import {
  findGame,
  findClosing,
  findWarmupActivity,
  findWarmupSet,
  genericActivityPlaceholder,
  getClosingVariants,
  getGameVariants,
  getGearLessonOverrideText,
  getWarmupActivityVariants,
  getWarmupSetVariants,
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

function resolveVariantText(variants, difficultyId, customOverride) {
  if (customOverride?.trim()) return customOverride.trim();
  if (!variants) return "";
  if (typeof variants === "string") return variants;
  return getDifficultyText(variants, difficultyId);
}

function resolveWarmupSetText(setId, difficultyId, customTexts = {}) {
  const key = `warmup-set-${setId}`;
  if (customTexts[key]?.trim()) return customTexts[key].trim();
  const block = getWarmupSetVariants(setId);
  if (block) return getDifficultyText(block.default, difficultyId);
  const set = findWarmupSet(setId);
  if (set?.script?.trim()) return set.script.trim();
  return genericActivityPlaceholder(set?.label || "Warm-up", difficultyId);
}

function resolveWarmupActivityText(activityId, difficultyId, customTexts = {}) {
  const key = `warmup-activity-${activityId}`;
  if (customTexts[key]?.trim()) return customTexts[key].trim();
  const block = getWarmupActivityVariants(activityId);
  if (block) return getDifficultyText(block.default, difficultyId);
  const activity = findWarmupActivity(activityId);
  return genericActivityPlaceholder(activity?.label || "Warm up", difficultyId);
}

function resolveGameText(gameId, difficultyId, customTexts = {}) {
  const key = `game-${gameId}`;
  if (customTexts[key]?.trim()) return customTexts[key].trim();
  const block = getGameVariants(gameId);
  if (block) return getDifficultyText(block.default, difficultyId);
  const game = findGame(gameId);
  return genericActivityPlaceholder(game?.label || "Game", difficultyId);
}

function resolveClosingText(closingId, difficultyId, customTexts = {}) {
  const key = `closing-${closingId}`;
  if (customTexts[key]?.trim()) return customTexts[key].trim();
  const block = getClosingVariants(closingId);
  if (block) return getDifficultyText(block.default, difficultyId);
  const closing = findClosing(closingId);
  return genericActivityPlaceholder(closing?.label || "Closing", difficultyId);
}

/** 기존 교구 대본 데이터에서 본문 추출 (관리자 오버라이드 우선) */
export function extractGearLessonText(gearId, levelId = "foundation") {
  const overrideText = getGearLessonOverrideText(gearId, levelId);
  const catalog = getGearCatalogEntry(gearId);
  if (!catalog) return { title: "", text: "" };
  if (overrideText != null) {
    return { title: catalog.label, text: overrideText };
  }

  if (catalog.type === "sections") {
    const sections = AIRBRIDGE_SCRIPTS[levelId] || AIRBRIDGE_SCRIPTS.foundation || [];
    const chunks = sections.map(section => {
      const body = scriptBlockToText(section.script, levelId);
      if (!body) return "";
      const heading = section.tagLabel || section.stage || "";
      return heading ? `— ${heading} —\n${body}` : body;
    }).filter(Boolean);
    return { title: catalog.label, text: chunks.join("\n\n") };
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
    if (activity.transitionIn?.[levelId]) pieces.push(activity.transitionIn[levelId]);
    const body = scriptBlockToText(activity.script, levelId);
    if (body) pieces.push(body);
    if (activity.transitionOut?.[levelId]) pieces.push(activity.transitionOut[levelId]);
    if (pieces.length) chunks.push(`— ${actTitle} —\n${pieces.join("\n")}`);
  }
  if (data.closing?.script) {
    const closingTitle = activityBlockTitle(data.closing, "Closing");
    const closingBody = scriptBlockToText(data.closing.script, levelId);
    if (closingBody) chunks.push(`— ${closingTitle} —\n${closingBody}`);
  }
  return { title: catalog.label, text: chunks.join("\n\n") };
}

/** items.safety_notes 가 있으면 교구 대본 본문 앞에 자연스럽게 붙인다. */
export function appendGearSafetyNotes(lessonText, safetyNotes) {
  const notes = String(safetyNotes || "").trim();
  const body = String(lessonText || "").trim();
  if (!notes) return body;
  const safetyBlock = `【안전 주의사항】\n${notes}`;
  return body ? `${safetyBlock}\n\n${body}` : safetyBlock;
}

/**
 * 선택 모듈 + 난이도 + 커스텀 텍스트로 완성 대본 생성
 */
export function composeLessonScript({
  warmupSetId,
  warmupActivityId,
  gearId,
  gameId,
  closingId,
  levelId = "foundation",
  difficultyId = "medium",
  customTexts = {},
  gearSafetyNotes = null,
}) {
  const sections = [];
  let order = 1;

  const warmupSet = findWarmupSet(warmupSetId);
  if (warmupSet) {
    sections.push({
      key: "warmup-set",
      order: order++,
      title: "1. 인사 & 워밍업",
      subtitle: warmupSet.label,
      text: resolveWarmupSetText(warmupSetId, difficultyId, customTexts),
      editableKey: `warmup-set-${warmupSetId}`,
      sectionType: "warmup-set",
      contextId: warmupSetId,
    });
  }

  if (warmupActivityId) {
    const warmup = findWarmupActivity(warmupActivityId);
    const text = resolveWarmupActivityText(warmupActivityId, difficultyId, customTexts);
    sections.push({
      key: "warmup-activity",
      order: order++,
      title: `${order - 1}. 준비운동`,
      subtitle: warmup?.label,
      text,
      editableKey: `warmup-activity-${warmupActivityId}`,
      sectionType: "warmup-activity",
      contextId: warmupActivityId,
    });
  }

  if (gearId) {
    const gearLesson = extractGearLessonText(gearId, levelId);
    const lessonBody = gearLesson.text || "(선택한 교구의 대본이 아직 등록되지 않았습니다.)";
    sections.push({
      key: "gear-lesson",
      order: order++,
      title: `${order - 1}. 교구 수업`,
      subtitle: gearLesson.title,
      text: appendGearSafetyNotes(lessonBody, gearSafetyNotes),
    });
  }

  if (gameId) {
    const game = findGame(gameId);
    sections.push({
      key: "game",
      order: order++,
      title: `${order - 1}. 게임 활동`,
      subtitle: game?.label,
      text: resolveGameText(gameId, difficultyId, customTexts),
      editableKey: `game-${gameId}`,
      sectionType: "game",
      contextId: gameId,
    });
  }

  if (closingId) {
    const closing = findClosing(closingId);
    sections.push({
      key: "closing",
      order: order++,
      title: `${order - 1}. 마무리 인사`,
      subtitle: closing?.label,
      text: resolveClosingText(closingId, difficultyId, customTexts),
      editableKey: `closing-${closingId}`,
      sectionType: "closing",
      contextId: closingId,
    });
  }

  // Renumber titles with clean step numbers
  for (const s of sections) {
    if (s.key === "warmup-set") {
      s.title = `${s.order}. 인사 & 워밍업`;
    } else if (s.key === "warmup-activity") {
      s.title = `${s.order}. 준비운동`;
    } else if (s.key === "gear-lesson") {
      s.title = `${s.order}. 교구 수업`;
    } else if (s.key === "game") {
      s.title = `${s.order}. 게임 활동`;
    } else if (s.key === "closing") {
      s.title = `${s.order}. 마무리 인사`;
    }
  }

  const fullText = sections
    .map(s => {
      if (s.parts?.length) {
        return `${s.title}\n${s.parts.map(p => `【${p.label}】\n${p.text}`).join("\n\n")}`;
      }
      return `${s.title}${s.subtitle && !s.title.includes(s.subtitle) ? ` · ${s.subtitle}` : ""}\n${s.text}`;
    })
    .join("\n\n────────────────────────\n\n");

  return { sections, fullText };
}

export { resolveVariantText };
