import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDirectTeachingPayRows,
  buildTeachingInstitutionDetail,
  buildTeachingInstitutionRows,
  ownLessonPayForInstitutions,
} from "./myTeachingInstitutions.js";

const me = "me";
const other = "other";
const bek = "bek";
const managed = "managed";

const slots = [
  {
    id: "mine",
    teacher_id: me,
    institution_id: bek,
    day_of_week: 1,
    class_type: "정규",
    label: "발레",
    start_time: "15:50:00",
    end_time: "16:50:00",
    effective_from: "2026-08-31",
    effective_to: "2026-10-01",
  },
  {
    id: "other-teacher",
    teacher_id: other,
    institution_id: bek,
    day_of_week: 1,
    class_type: "정규",
    start_time: "15:50:00",
    end_time: "16:50:00",
    effective_from: "2026-08-31",
    effective_to: null,
  },
  {
    id: "managed-slot",
    teacher_id: me,
    institution_id: managed,
    day_of_week: 1,
    class_type: "정규",
    start_time: "10:00:00",
    end_time: "11:00:00",
    effective_from: "2026-08-31",
    effective_to: null,
  },
];

describe("내가 수업하는 원", () => {
  it("담당 원과 다른 선생님 슬롯은 목록에서 빼다", () => {
    const rows = buildTeachingInstitutionRows({
      slots,
      entries: [],
      yearMonth: "2026-09",
      teacherId: me,
      managedIds: new Set([managed]),
      namesById: new Map([[bek, "BEK"]]),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "BEK");
    assert.equal(rows[0].classCount, 4);
    assert.equal(rows[0].scheduledMinutes, 240);
  });

  it("상세에는 본인 급여만 담고 다른 선생님 급여는 버린다", () => {
    const detail = buildTeachingInstitutionDetail({
      slots,
      entries: [
        {
          id: "mine-pay",
          teacher_id: me,
          institution_id: bek,
          class_date: "2026-09-07",
          pay_type: "정규",
          minutes: 60,
          entry_status: "as_scheduled",
          schedule_slot_id: "mine",
        },
        {
          id: "other-pay",
          teacher_id: other,
          institution_id: bek,
          class_date: "2026-09-07",
          pay_type: "정규",
          minutes: 60,
          entry_status: "as_scheduled",
          schedule_slot_id: "other-teacher",
        },
      ],
      yearMonth: "2026-09",
      teacherId: me,
      institutionId: bek,
      rates: [{
        teacher_id: me,
        pay_type: "정규",
        rate_unit: "minute",
        rate_per_minute: 1000,
        effective_from: "2026-08-01",
        institution_id: null,
      }],
    });
    assert.equal(detail.payrollRows.length, 1);
    assert.equal(detail.payrollRows[0].id, "mine-pay");
    assert.equal(detail.confirmedMinutes, 60);
    assert.equal(detail.unconfirmed.length, 3);
  });

  it("담당 원 본인 수업 급여는 따로 합산한다", () => {
    const pay = ownLessonPayForInstitutions({
      slots,
      entries: [
        {
          id: "managed-pay",
          teacher_id: me,
          institution_id: managed,
          class_date: "2026-09-07",
          pay_type: "정규",
          minutes: 60,
          entry_status: "as_scheduled",
          schedule_slot_id: "managed-slot",
        },
      ],
      yearMonth: "2026-09",
      teacherId: me,
      institutionIds: [managed],
      rates: [{
        teacher_id: me,
        pay_type: "정규",
        rate_unit: "minute",
        rate_per_minute: 1000,
        effective_from: "2026-08-01",
        institution_id: null,
      }],
    });
    assert.equal(pay, 60000);
  });
});

describe("직접 수업하는 원 급여", () => {
  const rachel = "rachel";
  const rates = ["정규", "방과후"].map((payType) => ({
    teacher_id: rachel,
    pay_type: payType,
    rate_unit: "revenue_share",
    share_ratio: 0.9,
    rate_per_minute: 0,
    effective_from: "2026-09-01",
    institution_id: null,
  }));
  const sessionRates = [
    { institution_id: bek, session_type: "정규", rate_per_session: 90000, effective_from: "2026-09-01" },
    { institution_id: bek, session_type: "방과후", rate_per_session: 90000, effective_from: "2026-08-31" },
  ];
  const regularClasses = Array.from({ length: 9 }, (_, index) => ({
    id: `bek-${index + 1}`,
    teacher_id: rachel,
    institution_id: bek,
    class_date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    pay_type: "정규",
    minutes: 50,
    entry_status: "as_scheduled",
    schedule_slot_id: "bek-slot",
    institutions: { id: bek, name: "BEK" },
  }));

  it("정규 9회는 회당 계약 9만 원, 본인 급여 72만 9천 원이다", () => {
    const rows = buildDirectTeachingPayRows({
      entries: [
        ...regularClasses,
        {
          id: "other-teacher",
          teacher_id: other,
          institution_id: bek,
          class_date: "2026-10-03",
          pay_type: "정규",
          minutes: 50,
          entry_status: "as_scheduled",
          institutions: { id: bek, name: "BEK" },
        },
        {
          id: "managed-class",
          teacher_id: rachel,
          institution_id: managed,
          class_date: "2026-10-03",
          pay_type: "정규",
          minutes: 50,
          entry_status: "as_scheduled",
        },
      ],
      slots: [{
        id: "bek-slot",
        teacher_id: rachel,
        institution_id: bek,
        label: "정규",
        start_time: "15:50:00",
        end_time: "16:40:00",
      }, {
        id: "other-slot",
        teacher_id: other,
        institution_id: bek,
        label: "다른 선생님",
        start_time: "10:00:00",
        end_time: "11:00:00",
      }],
      yearMonth: "2026-10",
      teacherId: rachel,
      managedIds: new Set([managed]),
      rates,
      sessionRates,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "BEK");
    assert.equal(rows[0].classCount, 9);
    assert.equal(rows[0].payTotal, 729000);
    assert.equal(rows[0].feeMode, "contract");
    assert.equal(rows[0].revenue, 810000);
    assert.equal(rows[0].managerShare, 729000);
    assert.deepEqual(rows[0].contractRates, [{ payType: "정규", unit: 90000 }]);
    assert.equal(rows[0].classes.every((item) => item.amount === 81000), true);
    assert.equal(rows[0].classes.some((item) => item.name === "다른 선생님"), false);
    assert.equal(JSON.stringify(rows).includes(other), false);
  });

  it("급여 행이 없어도 10월 본인 시간표 9회를 81,000원으로 센다", () => {
    const rows = buildDirectTeachingPayRows({
      entries: [{
        id: "other-october",
        teacher_id: other,
        institution_id: bek,
        class_date: "2026-10-08",
        pay_type: "방과후",
        minutes: 60,
        entry_status: "as_scheduled",
        institutions: { id: bek, name: "BEK" },
      }],
      slots: [
        {
          id: "tue",
          teacher_id: rachel,
          institution_id: bek,
          day_of_week: 2,
          class_type: "정규",
          label: "Garden 만1,2세 태권도",
          start_time: "15:50:00",
          end_time: "16:40:00",
          effective_from: "2026-10-02",
          effective_to: null,
          institutions: { id: bek, name: "BEK" },
        },
        {
          id: "thu",
          teacher_id: rachel,
          institution_id: bek,
          day_of_week: 4,
          class_type: "정규",
          label: "Garden 만1,2세 플레이짐",
          start_time: "15:50:00",
          end_time: "16:40:00",
          effective_from: "2026-09-20",
          effective_to: null,
          institutions: { id: bek, name: "BEK" },
        },
        {
          id: "ended",
          teacher_id: rachel,
          institution_id: bek,
          day_of_week: 2,
          class_type: "정규",
          start_time: "15:50:00",
          end_time: "16:40:00",
          effective_from: "2026-08-31",
          effective_to: "2026-09-19",
        },
      ],
      yearMonth: "2026-10",
      teacherId: rachel,
      managedIds: new Set(),
      rates,
      sessionRates,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].classCount, 9);
    assert.equal(rows[0].revenue, 810000);
    assert.equal(rows[0].vat, 81000);
    assert.equal(rows[0].managerShare, 729000);
    assert.equal(rows[0].payTotal, rows[0].managerShare);
    assert.deepEqual(rows[0].contractRates, [{ payType: "정규", unit: 90000 }]);
    assert.equal(JSON.stringify(rows).includes(other), false);
  });

  it("9월 BEK 정규 3회는 매출에서 부가세를 뺀 243,000원이다", () => {
    const rows = buildDirectTeachingPayRows({
      entries: [],
      slots: [
        {
          id: "thu",
          teacher_id: rachel,
          institution_id: bek,
          day_of_week: 4,
          class_type: "정규",
          label: "플레이짐",
          start_time: "15:50:00",
          end_time: "16:40:00",
          effective_from: "2026-09-20",
          effective_to: null,
          institutions: { name: "BEK" },
        },
        {
          id: "tue",
          teacher_id: rachel,
          institution_id: bek,
          day_of_week: 2,
          class_type: "정규",
          start_time: "15:50:00",
          end_time: "16:40:00",
          effective_from: "2026-09-20",
          effective_to: "2026-10-01",
          institutions: { name: "BEK" },
        },
      ],
      yearMonth: "2026-09",
      teacherId: rachel,
      managedIds: new Set(),
      rates,
      sessionRates,
    });
    assert.equal(rows[0].classCount, 3);
    assert.equal(rows[0].revenue, 270000);
    assert.equal(rows[0].vat, 27000);
    assert.equal(rows[0].managerShare, 243000);
    assert.equal(rows[0].payTotal, 243000);
  });

  it("원 회당 단가가 없으면 센터 회당 단가를 정규 수업에 쓰지 않는다", () => {
    const hannam = "hannam";
    const rows = buildDirectTeachingPayRows({
      entries: [{
        id: "hannam-class",
        teacher_id: rachel,
        institution_id: hannam,
        class_date: "2026-09-02",
        pay_type: "정규",
        minutes: 60,
        entry_status: "as_scheduled",
        institutions: { name: "한남센터" },
      }],
      yearMonth: "2026-09",
      teacherId: rachel,
      managedIds: new Set(),
      rates: [
        ...rates,
        {
          teacher_id: rachel,
          pay_type: "센터",
          rate_unit: "session",
          rate_per_session: 75000,
          rate_per_minute: 0,
          effective_from: "2026-09-01",
          institution_id: hannam,
        },
      ],
      sessionRates,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rateMissing, true);
    assert.equal(rows[0].payTotal, 0);
    assert.equal(rows[0].settlementRow, null);
  });

  it("센터 회당 단가는 원 계약 단가 없이 횟수만큼 담당자 몫이 된다", () => {
    const hannam = "hannam";
    const centerRate = {
      teacher_id: rachel,
      pay_type: "센터",
      rate_unit: "session",
      rate_per_session: 75000,
      rate_per_minute: 0,
      effective_from: "2026-09-01",
      institution_id: hannam,
    };
    const september = ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30"];
    const septemberRows = buildDirectTeachingPayRows({
      entries: september.map((classDate, index) => ({
        id: `hannam-${index + 1}`,
        teacher_id: rachel,
        institution_id: hannam,
        class_date: classDate,
        pay_type: "센터",
        minutes: 60,
        entry_status: "as_scheduled",
        institutions: { name: "한남센터" },
      })),
      yearMonth: "2026-09",
      teacherId: rachel,
      managedIds: new Set(),
      rates: [...rates, centerRate],
      sessionRates,
    });
    assert.equal(septemberRows[0].classCount, 5);
    assert.equal(septemberRows[0].feeMode, "instructor_fee");
    assert.equal(septemberRows[0].rateMissing, false);
    assert.equal(septemberRows[0].revenue, 0);
    assert.equal(septemberRows[0].vat, 0);
    assert.equal(septemberRows[0].managerShare, 375000);
    assert.equal(septemberRows[0].payTotal, 375000);
    assert.equal(septemberRows[0].settlementRow.manager_share, 375000);
    assert.equal(septemberRows[0].settlementRow.revenue, 0);
    assert.equal(septemberRows[0].classes.every((item) => item.amount === 75000), true);

    const octoberRows = buildDirectTeachingPayRows({
      entries: [],
      slots: [{
        id: "wed",
        teacher_id: rachel,
        institution_id: hannam,
        day_of_week: 3,
        class_type: "센터",
        label: "영어체육/6세",
        start_time: "15:30:00",
        end_time: "16:30:00",
        effective_from: "2026-09-02",
        effective_to: null,
        institutions: { name: "한남센터" },
      }],
      yearMonth: "2026-10",
      teacherId: rachel,
      managedIds: new Set(),
      rates: [...rates, centerRate],
      sessionRates,
    });
    assert.equal(octoberRows[0].classCount, 4);
    assert.equal(octoberRows[0].feeMode, "instructor_fee");
    assert.equal(octoberRows[0].rateMissing, false);
    assert.equal(octoberRows[0].managerShare, 300000);
    assert.equal(octoberRows[0].revenue, 0);
    assert.equal(octoberRows[0].vat, 0);
  });

  it("센터 회당 단가가 없으면 단가 입력 필요다", () => {
    const hannam = "hannam";
    const rows = buildDirectTeachingPayRows({
      entries: [{
        id: "hannam-missing",
        teacher_id: rachel,
        institution_id: hannam,
        class_date: "2026-09-02",
        pay_type: "센터",
        minutes: 60,
        entry_status: "as_scheduled",
        institutions: { name: "한남센터" },
      }],
      yearMonth: "2026-09",
      teacherId: rachel,
      managedIds: new Set(),
      rates,
      sessionRates,
    });
    assert.equal(rows[0].feeMode, "instructor_fee");
    assert.equal(rows[0].rateMissing, true);
    assert.equal(rows[0].managerShare, 0);
    assert.equal(rows[0].settlementRow, null);
  });

  it("수업이 없으면 빈 목록이다", () => {
    const rows = buildDirectTeachingPayRows({
      entries: [],
      yearMonth: "2026-10",
      teacherId: "oh",
      managedIds: new Set(),
      rates,
      sessionRates,
    });
    assert.deepEqual(rows, []);
  });
});
