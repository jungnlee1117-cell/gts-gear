import assert from "node:assert/strict";
import {
  DUPLICATE_ITEM_NAME_MESSAGE,
  findItemNameConflict,
  isDuplicateItemNameError,
  normalizeItemName,
} from "../src/itemNames.js";

const items = [
  { id: "a", name: "밸런스보드", code: "BAL-001" },
  { id: "b", name: "  Air Bridge ", code: "AIR-001" },
  { id: "c", name: "공", code: "BALL-001" },
];

assert.equal(normalizeItemName("  Hello World  "), "hello world");
assert.equal(normalizeItemName("AIR BRIDGE"), normalizeItemName("air bridge"));

assert.equal(findItemNameConflict(items, "밸런스보드")?.id, "a");
assert.equal(findItemNameConflict(items, "  밸런스보드  ")?.id, "a");
assert.equal(findItemNameConflict(items, "BALANCE BOARD"), null);
assert.equal(findItemNameConflict(items, "air bridge")?.id, "b");
assert.equal(findItemNameConflict(items, "AIR BRIDGE", "b"), null);
assert.equal(findItemNameConflict(items, "AIR BRIDGE", "a")?.id, "b");

assert.equal(isDuplicateItemNameError({ code: "23505" }), true);
assert.equal(isDuplicateItemNameError({ message: "items_name_normalized_unique" }), true);
assert.equal(isDuplicateItemNameError({ message: "other" }), false);
assert.equal(DUPLICATE_ITEM_NAME_MESSAGE, "중복된 이름입니다.");

console.log("itemNames tests passed");
