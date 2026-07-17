const BUCKET_KEYS = {
  warmup: new Set(["warmup-set"]),
  preparation: new Set(["safety-beforeWarmup", "warmup-activity"]),
  gear: new Set(["gear-intro", "safety-beforeGear", "gear-lesson"]),
  game: new Set(["safety-beforeGame", "game"]),
};

function bucketForStep(step) {
  return Object.entries(BUCKET_KEYS).find(([, keys]) => keys.has(step?.key))?.[0] || null;
}

function makeBucket(steps, detail = {}) {
  if (!steps.length && !detail.contentId && !detail.gearId) return null;
  return {
    ...detail,
    steps,
    text: steps.map(step => step?.text).filter(Boolean).join("\n\n"),
  };
}

/**
 * 현재 compose 결과를 저장용 v2 문서로 변환한다.
 * DB 컬럼 변경 없이 final_script_json 내부만 버전 관리한다.
 */
export function createFinalScriptV2(payload = {}) {
  const steps = Array.isArray(payload.sections) ? payload.sections : [];
  const grouped = { warmup: [], preparation: [], gear: [], game: [] };
  for (const step of steps) {
    const bucket = bucketForStep(step);
    if (bucket) grouped[bucket].push(step);
  }

  return {
    version: 2,
    fullText: payload.fullText || steps.map(step => step?.text).filter(Boolean).join("\n\n"),
    sections: {
      warmup: makeBucket(grouped.warmup, {
        contentId: payload.warmupSetId || null,
        customText: payload.customTexts || {},
      }),
      preparation: makeBucket(grouped.preparation, {
        contentId: payload.warmupActivityId || null,
        customText: payload.warmupActivityId
          ? payload.customTexts?.[`warmup-activity-${payload.warmupActivityId}`] || null
          : null,
      }),
      gear: makeBucket(grouped.gear, {
        contentId: payload.gearId || null,
        gearId: payload.gearId || null,
        levelId: payload.levelId || "foundation",
        customText: payload.customTexts?.["gear-intro"] || null,
      }),
      game: makeBucket(grouped.game, {
        contentId: payload.gameId || null,
        customText: payload.gameId
          ? payload.customTexts?.[`game-${payload.gameId}`] || null
          : null,
      }),
    },
  };
}

/** v1 배열 문서와 v2 문서를 모두 v2로 정규화한다. */
export function normalizeFinalScript(final = {}, selections = {}, customTexts = {}) {
  if (final?.version === 2 && final.sections && !Array.isArray(final.sections)) {
    return final;
  }
  return createFinalScriptV2({
    ...selections,
    customTexts,
    fullText: final?.fullText || "",
    sections: Array.isArray(final?.sections) ? final.sections : [],
  });
}

/** 기존 미리보기/인쇄 컴포넌트가 사용하는 평면 section 배열을 제공한다. */
export function flattenFinalScriptSections(final = {}) {
  const normalized = final?.version === 2
    ? final
    : normalizeFinalScript(final);
  return ["warmup", "preparation", "gear", "game"].flatMap(
    key => normalized.sections?.[key]?.steps || [],
  );
}

/** localStorage v1 행도 로드 즉시 v2 메모리 모델로 승격한다. */
export function normalizeLocalSavedLesson(row) {
  if (!row) return null;
  const final = normalizeFinalScript(
    row.finalScript || { fullText: row.fullText, sections: row.sections },
    row,
    row.customTexts || {},
  );
  return {
    ...row,
    version: 2,
    finalScript: final,
    fullText: final.fullText || "",
    sections: flattenFinalScriptSections(final),
  };
}
