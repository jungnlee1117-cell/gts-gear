import assert from "node:assert/strict";
import test from "node:test";
import {
  composeTimeChangeNote,
  parseTimeChangeNote,
} from "./changeReasonOptions.js";
import { effectiveSlotStatusLabel } from "./payrollCalendar.js";

test("시간변경 사유는 바뀐 시각을 메모에 남긴다", () => {
  const note = composeTimeChangeNote("14:00", "15:00", "비 때문에");
  assert.equal(note, "시간변경 · 14:00-15:00 · 비 때문에");
  assert.deepEqual(parseTimeChangeNote(note), {
    start: "14:00",
    end: "15:00",
    memo: "비 때문에",
  });
});

test("수업 카드에는 변경된 시간이 보인다", () => {
  const label = effectiveSlotStatusLabel(
    { scheduledMinutes: 40, dateStr: "2026-10-08" },
    {
      entry_status: "custom",
      minutes: 60,
      note: "시간변경 · 14:00-15:00",
    },
  );
  assert.equal(label, "시간변경 · 14:00–15:00");
});
