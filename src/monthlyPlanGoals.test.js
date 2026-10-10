import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCustomMonthlyGoal,
  mergeGoalsAfterGearFill,
  parseStoredPlanGoals,
  resolveMonthlyGoal,
  serializePlanGoals,
} from "./monthlyPlanGoals.js";

describe("월간 목표 저장", () => {
  it("예전 공통 영어 문장은 영어 연령에만 이어지고 한글 목표는 비워 둔다", () => {
    const parsed = parseStoredPlanGoals("같은 영어 목표");
    assert.equal(parsed.legacySharedEnglish, true);
    assert.equal(parsed.english["4"], "같은 영어 목표");
    assert.equal(parsed.english["7"], "같은 영어 목표");
    assert.equal(parsed.korean["3_4"], "");
    assert.equal(parsed.korean["5"], "");
    assert.equal(parsed.korean["7"], "");
  });

  it("연령별 JSON은 고친 연령만 유지하고 없는 한글 목표는 비워 둔다", () => {
    const parsed = parseStoredPlanGoals(JSON.stringify({
      4: "age 4",
      5: "age 5",
      6: "age 6",
      7: "age 7",
    }));
    assert.equal(parsed.legacySharedEnglish, false);
    assert.equal(parsed.english["5"], "age 5");
    assert.equal(parsed.korean["3_4"], "");
  });

  it("한글 목표를 한 연령만 고쳐도 다른 연령은 그대로다", () => {
    const saved = serializePlanGoals(
      { 4: "a", 5: "b", 6: "c", 7: "d" },
      { "3_4": "유아 목표", 5: "", 7: "초등 목표" },
    );
    const parsed = parseStoredPlanGoals(saved);
    assert.equal(parsed.english["6"], "c");
    assert.equal(parsed.korean["3_4"], "유아 목표");
    assert.equal(parsed.korean["5"], "");
    assert.equal(parsed.korean["7"], "초등 목표");
    assert.equal(resolveMonthlyGoal(parsed.korean["5"], "5~6세 기본"), "5~6세 기본");
    assert.equal(resolveMonthlyGoal(parsed.korean["3_4"], "3~4세 기본"), "유아 목표");
  });

  it("기본 문구인 목표만 새 문구로 바꾸고 수정한 목표는 유지한다", () => {
    assert.equal(isCustomMonthlyGoal("", "기본"), false);
    assert.equal(isCustomMonthlyGoal("기본", "기본"), false);
    assert.equal(isCustomMonthlyGoal("선생님이 고친 목표", "기본"), true);
    const kept = mergeGoalsAfterGearFill([
      { key: "3_4", saved: "선생님이 고친 목표", currentDefault: "3~4세 기본", nextDefault: "3~4세 새 문구" },
      { key: "5", saved: "5~6세 기본", currentDefault: "5~6세 기본", nextDefault: "5~6세 새 문구" },
      { key: "7", saved: "", currentDefault: "7세 기본", nextDefault: "7세 새 문구" },
    ], false);
    assert.equal(kept.customCount, 1);
    assert.equal(kept.goals["3_4"], "선생님이 고친 목표");
    assert.equal(kept.goals["5"], "5~6세 새 문구");
    assert.equal(kept.goals["7"], "7세 새 문구");
    const replaced = mergeGoalsAfterGearFill([
      { key: "3_4", saved: "선생님이 고친 목표", currentDefault: "3~4세 기본", nextDefault: "3~4세 새 문구" },
    ], true);
    assert.equal(replaced.goals["3_4"], "3~4세 새 문구");
  });
});
