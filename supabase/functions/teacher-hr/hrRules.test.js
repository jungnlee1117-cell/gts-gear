import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertContractMutable,
  buildHrStatusMap,
  buildSettlementRevealResult,
  canAccessHr,
  canListHrStatus,
  canRevealSettlement,
  isSignedContractLocked,
  publicSettlementPayload,
  requireEncryptionKey,
  requireSignAgreement,
  sanitizeLogValue,
  settlementRevealAuditRow,
  validateAccountNumber,
  validateResidentId,
  validateSettlementInput,
} from "./hrRules.js";
import {
  buildContractDocument,
  formatRateLine,
  normalizeContractRates,
  validateContractIssueInput,
} from "./contractTemplate.js";

function makeRrn(yy, mm, dd, gender, serial5 = "00000") {
  const body = `${yy}${mm}${dd}${gender}${serial5}`;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(body[i]) * weights[i];
  const check = (11 - (sum % 11)) % 10;
  return body + String(check);
}

const VALID_RRN = makeRrn("90", "01", "01", "1");
const VALID_ACCOUNT = "12345678901";

const teacher = { id: "teacher-1", role: "teacher" };
const admin = { id: "admin-1", role: "admin" };
const superadmin = { id: "super-1", role: "superadmin" };
const other = "teacher-2";

describe("teacher-hr settlement access (API rules)", () => {
  it("teacher: 본인 정산정보만 조회/수정", () => {
    assert.equal(canAccessHr(teacher, teacher.id), true);
    assert.equal(canAccessHr(teacher, other), false);
    assert.equal(canListHrStatus(teacher), false);
  });

  it("admin: 다른 선생님 정산정보 get/upsert 거부, 목록 배지만 허용", () => {
    assert.equal(canAccessHr(admin, admin.id), true);
    assert.equal(canAccessHr(admin, other), false);
    assert.equal(canAccessHr(admin, teacher.id), false);
    assert.equal(canListHrStatus(admin), true);
  });

  it("superadmin: 전체 정산정보 조회/수정 및 상태 목록", () => {
    assert.equal(canAccessHr(superadmin, teacher.id), true);
    assert.equal(canAccessHr(superadmin, admin.id), true);
    assert.equal(canAccessHr(superadmin, superadmin.id), true);
    assert.equal(canListHrStatus(superadmin), true);
  });

  it("전체보기: teacher 본인·superadmin만, 일반 admin은 불가", () => {
    assert.equal(canRevealSettlement(teacher, teacher.id), true);
    assert.equal(canRevealSettlement(teacher, other), false);
    assert.equal(canRevealSettlement(admin, admin.id), false);
    assert.equal(canRevealSettlement(admin, teacher.id), false);
    assert.equal(canRevealSettlement(superadmin, teacher.id), true);
    assert.equal(canRevealSettlement(superadmin, admin.id), true);
    assert.equal(canRevealSettlement(superadmin, superadmin.id), true);
    assert.equal(canRevealSettlement(admin, teacher.id, admin.id), true);
    assert.equal(canRevealSettlement(admin, teacher.id, "someone-else"), false);
  });

  it("SUPER_ADMIN_ID 가 있으면 해당 사용자만 관리자 권한", () => {
    assert.equal(canAccessHr(admin, teacher.id, admin.id), true);
    assert.equal(canListHrStatus(admin, admin.id), true);
    assert.equal(canAccessHr(admin, teacher.id, "someone-else"), false);
  });
});

describe("encryption key and log redaction", () => {
  it("키가 없으면 저장 실패", () => {
    assert.throws(() => requireEncryptionKey(""), /암호화 키/);
    assert.throws(() => requireEncryptionKey("   "), /암호화 키/);
    assert.doesNotThrow(() => requireEncryptionKey("set-in-prod"));
  });

  it("로그에 계좌·주민번호·서명이 남지 않는다", () => {
    const leaked = sanitizeLogValue({
      action: "upsert_settlement",
      account_number: VALID_ACCOUNT,
      resident_id: VALID_RRN,
      signature_data_url: "data:image/png;base64,AAAABBBB",
      message: `rrn ${VALID_RRN} account ${VALID_ACCOUNT}`,
    });
    const text = JSON.stringify(leaked);
    assert.equal(leaked.account_number, "[redacted]");
    assert.equal(leaked.resident_id, "[redacted]");
    assert.equal(leaked.signature_data_url, "[redacted]");
    assert.equal(text.includes(VALID_ACCOUNT), false);
    assert.equal(text.includes(VALID_RRN), false);
    assert.equal(text.includes("AAAABBBB"), false);
  });
});

describe("resident id and account server validation", () => {
  it("계좌번호는 8~16자리 숫자만 허용", () => {
    assert.equal(validateAccountNumber("123-45-678901"), "12345678901");
    assert.throws(() => validateAccountNumber("12345"), /8~16/);
    assert.throws(() => validateAccountNumber("00000000"), /올바르지/);
  });

  it("주민등록번호는 날짜+체크섬 검증", () => {
    assert.equal(validateResidentId("900101-1" + VALID_RRN.slice(7)), VALID_RRN);
    assert.throws(() => validateResidentId("900101123456"), /13자리/);
    assert.throws(() => validateResidentId("9002311234567"), /날짜/);
    const badChecksum = VALID_RRN.slice(0, 12) + ((Number(VALID_RRN[12]) + 1) % 10);
    assert.throws(() => validateResidentId(badChecksum), /형식/);
  });

  it("최초 등록 시 은행·예금주·계좌번호를 요구하고 주민번호는 선택", () => {
    assert.throws(() => validateSettlementInput(null, {
      bankName: "국민",
      accountHolder: "홍길동",
    }), /계좌번호/);
    const withoutRrn = validateSettlementInput(null, {
      bankName: "국민은행",
      accountHolder: "홍길동",
      accountNumber: VALID_ACCOUNT,
    });
    assert.equal(withoutRrn.accountDigits, VALID_ACCOUNT);
    assert.equal(withoutRrn.residentDigits, null);
    const ok = validateSettlementInput(null, {
      bankName: "국민은행",
      accountHolder: "홍길동",
      accountNumber: VALID_ACCOUNT,
      residentId: VALID_RRN,
    });
    assert.equal(ok.accountDigits, VALID_ACCOUNT);
    assert.equal(ok.residentDigits, VALID_RRN);
  });
});

describe("signed contract lock and agreement", () => {
  it("서명완료 행은 update/delete 모두 차단", () => {
    const signed = { status: "서명완료", id: "c1" };
    assert.equal(isSignedContractLocked(signed), true);
    assert.throws(() => assertContractMutable(signed, "update"), /수정/);
    assert.throws(() => assertContractMutable(signed, "delete"), /삭제/);
    assert.doesNotThrow(() => assertContractMutable({ status: "서명대기" }, "update"));
  });

  it("전자서명 동의 없이는 서명 완료 불가", () => {
    assert.throws(() => requireSignAgreement(false), /동의/);
    assert.throws(() => requireSignAgreement(undefined), /동의/);
    assert.doesNotThrow(() => requireSignAgreement(true));
  });

  it("공개 정산 응답에 암호문을 넣지 않는다", () => {
    const payload = publicSettlementPayload({
      teacher_id: "t1",
      bank_name: "국민",
      account_holder: "홍길동",
      account_number_mask: "123*****901",
      resident_id_mask: "900101-1******",
      account_number_ciphertext: "SHOULD_NOT_LEAK",
      resident_id_ciphertext: "SHOULD_NOT_LEAK",
    }, "t1");
    const text = JSON.stringify(payload);
    assert.equal(payload.has_account_number, true);
    assert.equal(text.includes("SHOULD_NOT_LEAK"), false);
    assert.equal(Object.hasOwn(payload, "account_number_ciphertext"), false);
  });

  it("전체보기 결과는 포맷만 반환하고, audit에는 필드명만 남긴다", () => {
    const revealed = buildSettlementRevealResult(VALID_ACCOUNT, VALID_RRN);
    assert.equal(revealed.account_number, VALID_ACCOUNT);
    assert.equal(revealed.resident_id, `${VALID_RRN.slice(0, 6)}-${VALID_RRN.slice(6)}`);
    assert.deepEqual(revealed.revealed_fields, ["account_number", "resident_id"]);

    const audit = settlementRevealAuditRow("viewer-1", "teacher-1", [
      "account_number",
      "resident_id",
      "account_number_ciphertext",
      VALID_ACCOUNT,
      VALID_RRN,
    ]);
    const text = JSON.stringify(audit);
    assert.deepEqual(audit.fields, ["account_number", "resident_id"]);
    assert.equal(Object.hasOwn(audit, "account_number"), false);
    assert.equal(Object.hasOwn(audit, "resident_id"), false);
    assert.equal(text.includes(VALID_ACCOUNT), false);
    assert.equal(text.includes(VALID_RRN), false);
  });

  it("목록 배지: 정산 완료/미등록, 계약 서명완료/대기", () => {
    const map = buildHrStatusMap(
      [{
        teacher_id: "t1",
        bank_name: "국민",
        account_holder: "홍",
        account_number_mask: "123***901",
        resident_id_mask: "900101-1******",
      }],
      [
        { teacher_id: "t1", status: "서명완료" },
        { teacher_id: "t1", status: "서명대기" },
        { teacher_id: "t2", status: "서명완료" },
      ],
    );
    assert.equal(map.t1.settlement, "완료");
    assert.equal(map.t1.contract, "서명대기");
    assert.equal(map.t2.settlement, "미등록");
    assert.equal(map.t2.contract, "서명완료");
  });
});

describe("GTS contract rates and template", () => {
  it("정규/방과후 금액과 추가 항목을 영문 unit 코드로 정규화한다", () => {
    const rates = normalizeContractRates([
      { rate_type: "regular", amount: "75,000", unit: "hour" },
      { rate_type: "after_school", amount: "85000", unit: "시간" },
      { rate_type: "event", amount: "90000", unit: "session" },
      { rate_type: "custom", rate_name: "야간수당", amount: "10000", unit: "day" },
    ]);
    assert.equal(rates[0].rate_name, "정규수업");
    assert.equal(rates[0].amount, 75000);
    assert.equal(rates[0].unit, "hour");
    assert.equal(rates[1].unit, "hour");
    assert.equal(rates[2].rate_type, "event");
    assert.equal(rates[2].unit, "session");
    assert.equal(rates[3].rate_name, "야간수당");
    assert.equal(rates[3].unit, "day");
  });

  it("정규수업·방과후수업 금액이 없으면 발행 불가", () => {
    assert.throws(() => normalizeContractRates([
      { rate_type: "regular", amount: "75000", unit: "hour" },
    ]), /방과후/);
    assert.throws(() => validateContractIssueInput({
      teacherName: "홍길동",
      contractType: "위탁계약",
      startDate: "2026-03-01",
      endDate: "2026-02-01",
      rates: [
        { rate_type: "regular", amount: "75000", unit: "hour" },
        { rate_type: "after_school", amount: "85000", unit: "hour" },
      ],
    }), /종료일/);
  });

  it("표준 계약서에 이름·기간·급여 조건을 치환하고 주민번호는 앞자리만 넣는다", () => {
    const doc = buildContractDocument({
      teacherName: "양의인",
      teacherPhone: "010-6281-5956",
      residentFront: "9001011234567",
      contractType: "위탁계약",
      startDate: "2026-09-01",
      endDate: "2027-08-31",
      contractDate: "2026-08-18",
      rates: [
        { rate_type: "regular", amount: 75000, unit: "hour" },
        { rate_type: "after_school", amount: 85000, unit: "hour" },
        { rate_type: "event", amount: 90000, unit: "session" },
        { rate_type: "private", amount: 60000, unit: "session" },
        { rate_type: "transportation", amount: 10000, unit: "day" },
      ],
    });
    assert.equal(doc.title, "교육용역 위탁 계약서");
    assert.equal(doc.placeholders.teacher_name, "양의인");
    assert.equal(doc.placeholders.teacher_phone, "010-6281-5956");
    assert.equal(doc.placeholders.resident_number_front, "900101-*******");
    assert.equal(doc.placeholders.regular_rate, "75,000");
    assert.equal(doc.placeholders.after_school_rate, "85,000");
    assert.equal(formatRateLine(doc.rates[2]), "행사수업: 회당 90,000원");
    assert.equal(formatRateLine(doc.rates[3]), "개인레슨: 회당 60,000원");
    assert.equal(formatRateLine(doc.rates[4]), "교통비: 일 10,000원");
    const extra = doc.additionalLines.join("\n");
    assert.match(extra, /행사수업/);
    assert.match(extra, /교통비/);
    const body = doc.sections.flatMap((s) => s.paragraphs).join("\n");
    const headings = doc.sections.map((s) => s.heading).join("\n");
    assert.match(headings, /제1조/);
    assert.match(headings, /제13조/);
    assert.match(body, /양의인/);
    assert.match(body, /2026년 9월 1일/);
    assert.match(body, /정규수업: 시간당 75,000원/);
    assert.match(body, /추가 지급 기준/);
    assert.equal(body.includes("1234567"), false);
    assert.equal(JSON.stringify(doc.placeholders).includes("1234567"), false);
    const signText = doc.signatureBlock.lines.join("\n");
    assert.match(signText, /^갑$/m);
    assert.match(signText, /회사명: 지티에스/);
    assert.match(signText, /대표자: 정형신/);
    assert.match(signText, /900101-\*\*\*\*\*\*\*/);
  });

  it("추가 급여가 없으면 추가 지급 기준 영역을 넣지 않는다", () => {
    const doc = buildContractDocument({
      teacherName: "홍길동",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      contractDate: "2026-03-01",
      rates: [
        { rate_type: "regular", amount: 75000, unit: "hour" },
        { rate_type: "after_school", amount: 85000, unit: "hour" },
      ],
    });
    assert.equal(doc.additionalLines.length, 0);
    assert.equal(doc.placeholders.additional_rates_list, "");
    const body = doc.sections.flatMap((s) => s.paragraphs).join("\n");
    assert.equal(body.includes("추가 지급 기준"), false);
  });
});
