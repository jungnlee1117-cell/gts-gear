import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEnglishActivity,
  buildEnglishPurpose,
  fallbackEnglishPlanText,
  isGenericEnglishActivity,
  isGenericEnglishPurpose,
} from "./englishPlanSentences.js";

describe("영어 계획안 범용 문장", () => {
  it("교구와 무관한 활동·목적 문장만 검토 대상으로 본다", () => {
    const genericBase = fallbackEnglishPlanText("리본막대", "Rhythm Ribbons");
    const genericActivity = buildEnglishActivity({
      name: "리본막대",
      englishName: "Rhythm Ribbons",
      englishActivity: genericBase,
    }, "5", 0);
    const genericPurpose = buildEnglishPurpose({
      name: "리본막대",
      englishName: "Rhythm Ribbons",
      englishActivity: genericBase,
    }, "6", 1);
    assert.equal(isGenericEnglishActivity(genericActivity), true);
    assert.equal(isGenericEnglishPurpose(genericPurpose), true);

    const donutBase = fallbackEnglishPlanText("도넛쌓기", "Donut Stacking Rings");
    const donutActivity = buildEnglishActivity({
      name: "도넛쌓기",
      englishName: "Donut Stacking Rings",
      englishActivity: donutBase,
    }, "7", 0);
    const donutPurpose = buildEnglishPurpose({
      name: "도넛쌓기",
      englishName: "Donut Stacking Rings",
      englishActivity: donutBase,
    }, "5", 0);
    assert.equal(isGenericEnglishActivity(donutActivity), false);
    assert.equal(isGenericEnglishPurpose(donutPurpose), false);
  });

  it("선생님이 문장을 고치면 검토 표시 조건에서 빠진다", () => {
    const activity = buildEnglishActivity({
      englishActivity: fallbackEnglishPlanText("리본막대", ""),
    }, "5", 0);
    assert.equal(isGenericEnglishActivity(`${activity} Add a ribbon shape.`), false);
    assert.equal(isGenericEnglishActivity(activity.replace("simple games", "ribbon shapes")), false);
    assert.equal(isGenericEnglishPurpose("Strengthens ribbon control through repeated swings."), false);
  });
});