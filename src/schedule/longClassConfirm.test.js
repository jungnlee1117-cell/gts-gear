import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { longClassConfirmMessage } from "./longClassConfirm.js";

describe("longClassConfirmMessage", () => {
  it("2시간 이하는 확인 문구를 만들지 않는다", () => {
    assert.equal(longClassConfirmMessage(30), null);
    assert.equal(longClassConfirmMessage(120), null);
    assert.equal(longClassConfirmMessage(0), null);
  });

  it("2시간을 넘으면 시간·분 확인 문구를 만든다", () => {
    assert.equal(longClassConfirmMessage(121), "정말 2시간 1분이 맞습니까?");
    assert.equal(longClassConfirmMessage(150), "정말 2시간 30분이 맞습니까?");
    assert.equal(longClassConfirmMessage(180), "정말 3시간이 맞습니까?");
    assert.equal(longClassConfirmMessage(750), "정말 12시간 30분이 맞습니까?");
  });
});
