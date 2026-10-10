import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  entryPayAmount,
  institutionSessionUnitPrice,
  payAmountFromRateRow,
} from "./settlement.js";

describe("회당 단가", () => {
  const sessionRate = {
    teacher_id: "t1",
    pay_type: "정규",
    institution_id: null,
    effective_from: "2026-03-01",
    rate_unit: "session",
    rate_per_session: 30000,
    rate_per_minute: 0,
  };

  it("수업 시간과 관계없이 1회 금액을 지급한다", () => {
    assert.equal(payAmountFromRateRow(30, sessionRate), 30000);
    assert.equal(payAmountFromRateRow(90, sessionRate), 30000);
  });

  it("급여 항목도 회당 금액으로 계산한다", () => {
    const amount = entryPayAmount({
      teacher_id: "t1",
      pay_type: "정규",
      class_date: "2026-09-02",
      minutes: 40,
      institution_id: null,
    }, [sessionRate]);
    assert.equal(amount, 30000);
  });
});

describe("매출 배분 단가", () => {
  const bek = "bek";
  const share = {
    teacher_id: "manager",
    pay_type: "정규",
    institution_id: null,
    effective_from: "2026-09-01",
    rate_unit: "revenue_share",
    share_ratio: 0.9,
    rate_per_minute: 0,
  };
  const sessionRates = [
    { institution_id: bek, session_type: "정규", rate_per_session: 90000, effective_from: "2026-09-01" },
    { institution_id: bek, session_type: "방과후", rate_per_session: 90000, effective_from: "2026-08-31" },
    { institution_id: "other", session_type: "인당", rate_per_session: 25300, effective_from: "2025-01-01" },
  ];

  it("수업 구분과 같은 회당 단가의 90%를 지급한다", () => {
    const amount = entryPayAmount({
      teacher_id: "manager",
      pay_type: "정규",
      class_date: "2026-10-06",
      minutes: 50,
      institution_id: bek,
    }, [share], {}, sessionRates);
    assert.equal(amount, 81000);
  });

  it("9월 1일 이전 수업에는 배분율을 적용하지 않는다", () => {
    const amount = entryPayAmount({
      teacher_id: "manager",
      pay_type: "정규",
      class_date: "2026-08-31",
      minutes: 50,
      institution_id: bek,
    }, [share], {}, sessionRates);
    assert.equal(amount, 0);
  });

  it("참관수업은 배분율보다 15,000원이 우선한다", () => {
    const amount = entryPayAmount({
      teacher_id: "manager",
      pay_type: "참관수업",
      class_date: "2026-10-06",
      minutes: 50,
      institution_id: bek,
    }, [{ ...share, pay_type: "참관수업" }], {}, sessionRates);
    assert.equal(amount, 15000);
  });

  it("인당 단가만 있는 원은 수업 급여가 0원이다", () => {
    assert.equal(institutionSessionUnitPrice(sessionRates, "other", "정규", "2026-10-06"), 0);
  });
});
