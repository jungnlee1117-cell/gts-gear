import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatStoredRate, revenueShareListLabel } from "./payRateLabel.js";

const won = (n) => `${Math.round(n || 0).toLocaleString("ko-KR")}원`;

describe("강사 단가 표시", () => {
  it("매출 연동 90%를 그대로 보여 준다", () => {
    const label = formatStoredRate({
      rate_unit: "revenue_share",
      share_ratio: 0.9,
      rate_per_minute: 0,
    }, won);
    assert.equal(label, "매출 연동 90%");
  });

  it("DB에서 온 0.9000 문자열도 90%로 보여 준다", () => {
    assert.equal(formatStoredRate({
      rate_unit: "revenue_share",
      share_ratio: "0.9000",
      rate_per_minute: "0.00",
    }, won), "매출 연동 90%");
  });

  it("목록에는 같은 배분율을 한 번만 붙인다", () => {
    const label = revenueShareListLabel([
      { rate_unit: "revenue_share", share_ratio: 0.9, pay_type: "정규" },
      { rate_unit: "revenue_share", share_ratio: 0.9, pay_type: "방과후" },
    ]);
    assert.equal(label, "매출 연동 90%");
  });
});
