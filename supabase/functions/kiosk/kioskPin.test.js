import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertValidPin,
  hashKioskPin,
  isValidPin,
  normalizePin,
  timingSafeEqual,
  verifyKioskPin,
} from "./kioskPin.js";

describe("kiosk pin helpers", () => {
  it("PIN은 숫자 4자리만 허용", () => {
    assert.equal(normalizePin("12ab34"), "1234");
    assert.equal(isValidPin("1234"), true);
    assert.equal(isValidPin("12"), false);
    assert.throws(() => assertValidPin("abcd"), /4자리/);
  });

  it("동일 teacher+pin 은 같은 해시를 만든다", async () => {
    const secret = "test-secret-key";
    const a = await hashKioskPin("teacher-1", "1234", secret);
    const b = await hashKioskPin("teacher-1", "1234", secret);
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it("다른 teacher 또는 pin 은 다른 해시", async () => {
    const secret = "test-secret-key";
    const a = await hashKioskPin("teacher-1", "1234", secret);
    const b = await hashKioskPin("teacher-2", "1234", secret);
    const c = await hashKioskPin("teacher-1", "9999", secret);
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  });

  it("verifyKioskPin 은 저장된 해시와 비교한다", async () => {
    const secret = "test-secret-key";
    const hash = await hashKioskPin("t1", "5678", secret);
    assert.equal(await verifyKioskPin("t1", "5678", hash, secret), true);
    assert.equal(await verifyKioskPin("t1", "0000", hash, secret), false);
  });

  it("timingSafeEqual", () => {
    assert.equal(timingSafeEqual("1234", "1234"), true);
    assert.equal(timingSafeEqual("1234", "1235"), false);
    assert.equal(timingSafeEqual("123", "1234"), false);
  });
});
