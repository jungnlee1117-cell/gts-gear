import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OMITTED_RENTAL_LOCATION,
  rentalPartyTitle,
  visibleRentalLocation,
} from "./rentalInstitutionOptions.js";

describe("대여 장소 표시", () => {
  it("과거 기관명은 그대로 보여 준다", () => {
    assert.equal(visibleRentalLocation("광교폴리"), "광교폴리");
    assert.equal(visibleRentalLocation("사무실"), "사무실");
    assert.equal(rentalPartyTitle("오주영", "광교폴리"), "오주영 · 광교폴리");
  });

  it("비어 있거나 기관 없이 저장한 문구는 화면에 내지 않는다", () => {
    assert.equal(visibleRentalLocation(null), "");
    assert.equal(visibleRentalLocation(undefined), "");
    assert.equal(visibleRentalLocation(""), "");
    assert.equal(visibleRentalLocation("  "), "");
    assert.equal(visibleRentalLocation(OMITTED_RENTAL_LOCATION), "");
    assert.equal(rentalPartyTitle("오주영", OMITTED_RENTAL_LOCATION), "오주영");
    assert.equal(rentalPartyTitle("", null), "선생님");
  });
});
