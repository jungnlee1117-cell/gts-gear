import { useEffect, useMemo, useState } from "react";
import { formatWon, minutesBetween, PAY_TYPES, timesOverlap } from "./constants.js";
import {
  resolveChangeReason,
  validateChangeReason,
} from "./changeReasonOptions.js";
import ChangeReasonField from "./ChangeReasonField.jsx";
import { createManualExtraEntryWithNotification } from "./payrollSaveWithNotification.js";
import {
  insertAdditionalPaymentRequest,
  insertApprovedAdditionalPaymentRequest,
} from "./api.js";
import { ENTRY_STATUS } from "./payrollCalendar.js";
import { pickRateForDate, payAmountFromMinutesAndRate } from "./settlement.js";
import TimeDualInput from "./TimeDualInput.jsx";
import {
  EXPENSE_TYPES,
  isExpenseType,
  uploadExpenseReceipt,
} from "./expenseReceipts.js";

export const UNIFIED_CLASS_TYPES = [...PAY_TYPES, "개인레슨"];

const EMPTY_FORM = {
  class_date: "",
  start_time: "",
  end_time: "",
  class_type: "방과후",
  rate_type: "방과후",
  institution_id: "",
  institution_query: "",
  amount: "",
  reasonPreset: "",
  reasonCustom: "",
  memo: "",
  expense_detail: "",
  receipt_file: null,
};

function buildEmptyForm(defaultDate = "") {
  return { ...EMPTY_FORM, class_date: defaultDate || "" };
}

function resolveBillingPayType(classType, rateType) {
  if (classType === "개인레슨") {
    return PAY_TYPES.includes(rateType) ? rateType : "방과후";
  }
  return PAY_TYPES.includes(classType) ? classType : "방과후";
}

function findOverlappingBusy(start, end, busyRanges = []) {
  for (const range of busyRanges || []) {
    if (!range?.start || !range?.end) continue;
    if (timesOverlap(start, end, range.start, range.end)) return range;
  }
  return null;
}

/**
 * 수업 · 추가수당 · 비용 통합 등록 폼
 * - 수업 유형: 즉시 급여 반영 + 슈퍼관리자 알림
 * - 비용 유형: additional_payment_requests 신청 (승인 대기)
 */
export default function PayrollUnifiedAddForm({
  teacherId,
  teacherName = "",
  yearMonth,
  defaultDate = "",
  institutions = [],
  rates = [],
  /** @type {{ start: string, end: string, label?: string }[]} 같은 날 기존 수업 시간대 */
  busyRanges = [],
  skipPush = false,
  /** 슈퍼관리자: 비용 신청을 승인 없이 추가지급에 즉시 반영 */
  autoApproveExpense = false,
  reviewerId = null,
  isInstitutionLocked = () => false,
  onSaved,
  disabled = false,
}) {
  const [form, setForm] = useState(() => buildEmptyForm(defaultDate));
  const [saving, setSaving] = useState(false);
  const [instOpen, setInstOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState("");

  const isExpense = isExpenseType(form.class_type);

  useEffect(() => {
    if (!defaultDate) return;
    setForm((f) => (f.class_date === defaultDate ? f : { ...f, class_date: defaultDate }));
  }, [defaultDate]);

  useEffect(() => () => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
  }, [receiptPreview]);

  const amountEntered = String(form.amount).trim() !== "" && Number(form.amount) > 0;

  const mins = useMemo(
    () => (form.start_time && form.end_time ? minutesBetween(form.start_time, form.end_time) : 0),
    [form.start_time, form.end_time],
  );

  const dayBusyRanges = useMemo(() => {
    if (!form.class_date || !defaultDate || form.class_date !== defaultDate) return [];
    return busyRanges;
  }, [busyRanges, form.class_date, defaultDate]);

  const overlap = useMemo(() => {
    if (isExpense || !form.start_time || !form.end_time) return null;
    return findOverlappingBusy(form.start_time, form.end_time, dayBusyRanges);
  }, [isExpense, form.start_time, form.end_time, dayBusyRanges]);

  const billingPayType = resolveBillingPayType(form.class_type, form.rate_type);
  const institutionId = form.class_type === "개인레슨" || isExpense ? "" : form.institution_id;

  const ratePerMinute = useMemo(() => {
    if (isExpense || !teacherId || !form.class_date) return 0;
    return Number(pickRateForDate(
      rates,
      teacherId,
      billingPayType,
      form.class_date,
      institutionId || null,
    )) || 0;
  }, [isExpense, rates, teacherId, billingPayType, form.class_date, institutionId]);

  const autoAmount = !isExpense && mins > 0 && ratePerMinute > 0
    ? Math.round(payAmountFromMinutesAndRate(mins, ratePerMinute))
    : 0;
  const previewAmount = amountEntered ? Number(form.amount) : autoAmount;

  const institutionName = useMemo(() => {
    if (isExpense) return "";
    if (form.class_type === "개인레슨") return "개인레슨";
    return institutions.find((i) => i.id === form.institution_id)?.name || "";
  }, [isExpense, form.class_type, form.institution_id, institutions]);

  const filteredInstitutions = useMemo(() => {
    const q = form.institution_query.trim().toLowerCase();
    if (!q) return institutions.slice(0, 12);
    return institutions
      .filter((i) => String(i.name || "").toLowerCase().includes(q))
      .slice(0, 12);
  }, [form.institution_query, institutions]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const selectClassType = (classType) => {
    setForm((f) => {
      const next = { ...f, class_type: classType };
      if (isExpenseType(classType)) {
        next.start_time = "";
        next.end_time = "";
        next.institution_id = "";
        next.institution_query = "";
        next.reasonPreset = "";
        next.reasonCustom = "";
        return next;
      }
      if (classType === "개인레슨") {
        next.institution_id = "";
        next.institution_query = "";
        if (!PAY_TYPES.includes(f.rate_type)) next.rate_type = "방과후";
      } else {
        next.rate_type = classType;
      }
      return next;
    });
  };

  const selectInstitution = (inst) => {
    setForm((f) => ({
      ...f,
      institution_id: inst.id,
      institution_query: inst.name || "",
      class_type: f.class_type === "개인레슨" ? "방과후" : f.class_type,
      rate_type: f.class_type === "개인레슨" ? "방과후" : f.rate_type,
    }));
    setInstOpen(false);
  };

  const clearInstitution = () => {
    setForm((f) => ({ ...f, institution_id: "", institution_query: "" }));
  };

  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setForm((f) => ({ ...f, receipt_file: file }));
    setReceiptPreview(file ? URL.createObjectURL(file) : "");
  };

  const clearReceipt = () => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview("");
    setForm((f) => ({ ...f, receipt_file: null }));
  };

  const handleSubmitExpense = async () => {
    if (!form.class_date) return alert("날짜를 선택해주세요.");
    if (!amountEntered) return alert("금액을 입력해주세요.");
    const detail = String(form.expense_detail || "").trim();
    if (!detail) return alert("세부 내용을 입력해주세요. (예: 잠복결핵 검사, 점심 식대)");

    setSaving(true);
    try {
      let receiptUrl = null;
      if (form.receipt_file) {
        receiptUrl = await uploadExpenseReceipt(teacherId, form.receipt_file);
      }
      const payload = {
        teacher_id: teacherId,
        year_month: yearMonth,
        event_date: form.class_date,
        amount: Number(form.amount),
        reason: form.class_type,
        memo: detail,
        request_kind: "expense",
        expense_type: form.class_type,
        receipt_url: receiptUrl,
        location: null,
        start_time: null,
        end_time: null,
      };

      if (autoApproveExpense) {
        await insertApprovedAdditionalPaymentRequest({
          ...payload,
          reviewed_by: reviewerId || teacherId,
          created_by: reviewerId || teacherId,
        });
        alert("비용이 추가지급에 바로 반영되었습니다.");
        clearReceipt();
        setForm(buildEmptyForm(defaultDate || form.class_date));
        setInstOpen(false);
        await onSaved?.({ mode: "immediate" });
      } else {
        await insertAdditionalPaymentRequest(payload);
        alert("비용 신청이 접수되었습니다. 관리자 승인 후 추가지급에 반영됩니다.");
        clearReceipt();
        setForm(buildEmptyForm(defaultDate || form.class_date));
        setInstOpen(false);
        await onSaved?.({ mode: "request" });
      }
    } catch (err) {
      alert("저장 실패: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitLesson = async () => {
    if (!form.class_date) return alert("날짜를 선택해주세요.");
    if (!form.start_time || !form.end_time) return alert("시작·종료 시간을 입력해주세요.");
    if (form.start_time >= form.end_time) return alert("종료 시간은 시작 시간보다 늦어야 합니다.");
    if (!mins || mins <= 0) return alert("수업 시간이 올바르지 않습니다.");

    const hit = findOverlappingBusy(form.start_time, form.end_time, dayBusyRanges);
    if (hit) {
      const when = `${String(hit.start).slice(0, 5)}–${String(hit.end).slice(0, 5)}`;
      const who = hit.label ? ` (${hit.label})` : "";
      return alert(`같은 날 ${when}${who} 수업과 시간이 겹칩니다. 다른 시간을 선택해주세요.`);
    }

    const reasonErr = validateChangeReason(form.reasonPreset, form.reasonCustom);
    if (reasonErr) return alert(reasonErr);
    const reason = resolveChangeReason(form.reasonPreset, form.reasonCustom);

    let finalInstitutionId = form.class_type === "개인레슨"
      ? null
      : (form.institution_id || null);
    if (!finalInstitutionId && form.class_type !== "개인레슨" && form.institution_query.trim()) {
      const match = institutions.find(
        (i) => String(i.name || "").trim() === form.institution_query.trim(),
      );
      if (match) finalInstitutionId = match.id;
    }
    if (finalInstitutionId && isInstitutionLocked(finalInstitutionId)) {
      return alert("정산 확정된 원은 추가할 수 없습니다.");
    }

    const locationLabel = finalInstitutionId
      ? (institutions.find((i) => i.id === finalInstitutionId)?.name || "")
      : "개인레슨";

    const memoParts = [];
    if (form.memo?.trim()) memoParts.push(form.memo.trim());
    memoParts.push(`${form.class_type} · ${billingPayType} · ${mins}분`);
    if (previewAmount > 0) memoParts.push(formatWon(previewAmount));
    const memo = memoParts.join(" / ");

    setSaving(true);
    try {
      await createManualExtraEntryWithNotification({
        teacher_id: teacherId,
        institution_id: finalInstitutionId,
        class_date: form.class_date,
        pay_type: billingPayType,
        minutes: mins,
        entry_status: ENTRY_STATUS.custom,
        note: memo || null,
      }, {
        institutionName: locationLabel === "개인레슨" ? "" : locationLabel,
        changeReason: reason,
        teacherName,
        classType: form.class_type,
        amount: previewAmount,
        skipPush,
      });
      alert(
        skipPush
          ? "수업이 급여에 반영되었습니다."
          : "수업이 급여에 반영되었습니다. 슈퍼관리자에게 알림이 전송됩니다.",
      );

      setForm(buildEmptyForm(defaultDate || form.class_date));
      setInstOpen(false);
      await onSaved?.({ mode: "immediate" });
    } catch (err) {
      alert("저장 실패: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disabled || saving) return;
    if (isExpense) return handleSubmitExpense();
    return handleSubmitLesson();
  };

  return (
    <form className="sch-form sch-unified-add-form" onSubmit={handleSubmit}>
      <div className="sch-unified-add-grid">
        <div className="sch-unified-add-col">
          <label className="sch-field">
            <span>날짜 <em className="sch-req">*</em></span>
            <input
              type="date"
              className="sch-input"
              required
              disabled={disabled}
              value={form.class_date}
              onChange={(e) => setField("class_date", e.target.value)}
            />
          </label>

          <div className="sch-field">
            <span>수업 유형</span>
            <div className="sch-chip-row sch-unified-chips">
              {UNIFIED_CLASS_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  className={`sch-chip${form.class_type === t ? " active" : ""}`}
                  onClick={() => selectClassType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="sch-field">
            <span>비용 유형</span>
            <div className="sch-chip-row sch-unified-chips sch-unified-chips--expense">
              {EXPENSE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  className={`sch-chip sch-chip--expense${form.class_type === t ? " active" : ""}`}
                  onClick={() => selectClassType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {!isExpense && form.class_type === "개인레슨" ? (
            <div className="sch-field">
              <span>단가 유형 <em className="sch-req">*</em></span>
              <p className="sch-field-hint sch-field-hint--quiet">원을 비우고, 아래 유형 단가로 계산합니다.</p>
              <div className="sch-chip-row sch-unified-chips">
                {PAY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    className={`sch-chip${form.rate_type === t ? " active" : ""}`}
                    onClick={() => setField("rate_type", t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!isExpense ? (
            <>
              <div className="sch-unified-time-row">
                <div className="sch-field">
                  <span>시작 시간 <em className="sch-req">*</em></span>
                  <TimeDualInput
                    required
                    disabled={disabled}
                    value={form.start_time}
                    onChange={(v) => setField("start_time", v)}
                  />
                </div>
                <div className="sch-unified-time-sep" aria-hidden>~</div>
                <div className="sch-field">
                  <span>종료 시간 <em className="sch-req">*</em></span>
                  <TimeDualInput
                    required
                    disabled={disabled}
                    value={form.end_time}
                    onChange={(v) => setField("end_time", v)}
                  />
                </div>
              </div>
              {mins > 0 ? (
                <p className="sch-unified-mins">수업 {mins}분</p>
              ) : null}
              {overlap ? (
                <p className="sch-field-hint sch-unified-overlap-warn">
                  주의: {String(overlap.start).slice(0, 5)}–{String(overlap.end).slice(0, 5)}
                  {overlap.label ? ` ${overlap.label}` : ""} 수업과 시간이 겹칩니다.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="sch-unified-add-col">
          {!isExpense ? (
            <div className="sch-field sch-inst-search">
              <span>
                원(기관)
                {form.class_type === "개인레슨"
                  ? " (개인레슨 — 비워둠)"
                  : " (검색)"}
              </span>
              <div className="sch-inst-search-row">
                <input
                  type="text"
                  className="sch-input"
                  disabled={disabled || form.class_type === "개인레슨"}
                  placeholder={form.class_type === "개인레슨" ? "개인레슨" : "원 이름 검색"}
                  value={form.class_type === "개인레슨" ? "" : form.institution_query}
                  onChange={(e) => {
                    setField("institution_query", e.target.value);
                    setField("institution_id", "");
                    setInstOpen(true);
                  }}
                  onFocus={() => setInstOpen(true)}
                  onBlur={() => setTimeout(() => setInstOpen(false), 150)}
                  autoComplete="off"
                />
                {form.institution_id && form.class_type !== "개인레슨" ? (
                  <button
                    type="button"
                    className="sch-btn sch-btn--ghost sch-btn--sm"
                    disabled={disabled}
                    onClick={clearInstitution}
                  >
                    지우기
                  </button>
                ) : null}
              </div>
              {instOpen && form.class_type !== "개인레슨" && filteredInstitutions.length > 0 ? (
                <ul className="sch-inst-search-list" role="listbox">
                  {filteredInstitutions.map((inst) => (
                    <li key={inst.id}>
                      <button
                        type="button"
                        className="sch-inst-search-option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectInstitution(inst)}
                      >
                        {inst.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {institutionName && form.class_type !== "개인레슨" && form.institution_id ? (
                <p className="sch-field-hint">선택: {institutionName}</p>
              ) : null}
            </div>
          ) : null}

          <label className="sch-field">
            <span>금액 (원) {isExpense ? <em className="sch-req">*</em> : null}</span>
            <input
              type="number"
              className="sch-input"
              min={1}
              required={isExpense}
              disabled={disabled}
              placeholder={
                isExpense
                  ? "금액 직접 입력"
                  : (autoAmount > 0 ? `비우면 자동 ${formatWon(autoAmount)}` : "입력 또는 비워 자동 계산")
              }
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
            />
            {!isExpense ? (
              <span className="sch-field-hint sch-field-hint--quiet">
                {amountEntered
                  ? "금액은 알림·안내용입니다. 급여는 수업 시간(분)으로 반영됩니다."
                  : ratePerMinute > 0
                    ? `자동 계산: ${mins || 0}분 × ${ratePerMinute.toLocaleString("ko-KR")}원 = ${formatWon(autoAmount)} (${billingPayType})`
                    : "등록된 단가가 없으면 금액을 입력해 알림에 표시할 수 있습니다."}
              </span>
            ) : (
              <span className="sch-field-hint sch-field-hint--quiet">
                관리자 승인 후 추가지급에 반영됩니다.
              </span>
            )}
          </label>

          {isExpense ? (
            <>
              <label className="sch-field">
                <span>세부 내용 <em className="sch-req">*</em></span>
                <input
                  type="text"
                  className="sch-input"
                  required
                  disabled={disabled}
                  placeholder='예: 잠복결핵 검사, 점심 식대'
                  value={form.expense_detail}
                  onChange={(e) => setField("expense_detail", e.target.value)}
                />
              </label>

              <div className="sch-field">
                <span>영수증 사진 (선택)</span>
                <input
                  type="file"
                  className="sch-input"
                  accept="image/*"
                  disabled={disabled}
                  onChange={handleReceiptChange}
                />
                {form.receipt_file || receiptPreview ? (
                  <div className="sch-expense-receipt-preview">
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="영수증 미리보기" />
                    ) : null}
                    <button
                      type="button"
                      className="sch-btn sch-btn--ghost sch-btn--sm"
                      disabled={disabled}
                      onClick={clearReceipt}
                    >
                      사진 제거
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <ChangeReasonField
                preset={form.reasonPreset}
                customText={form.reasonCustom}
                onPresetChange={(preset) => setField("reasonPreset", preset)}
                onCustomChange={(text) => setField("reasonCustom", text)}
                required
              />

              <label className="sch-field">
                <span>메모 (선택)</span>
                <input
                  type="text"
                  className="sch-input"
                  disabled={disabled}
                  placeholder="수업 내용·특이사항"
                  value={form.memo}
                  onChange={(e) => setField("memo", e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {previewAmount > 0 ? (
        <p className="sch-unified-preview">
          {isExpense ? "신청 금액" : "예상 금액"}: <strong>{formatWon(previewAmount)}</strong>
          {isExpense ? ` · ${form.class_type}` : null}
        </p>
      ) : null}

      <button
        type="submit"
        className="sch-btn sch-btn--primary sch-btn--block"
        disabled={disabled || saving || Boolean(overlap)}
      >
        {saving ? "저장 중..." : (isExpense
          ? (autoApproveExpense ? "비용 바로 등록" : "비용 신청하기")
          : "등록하기")}
      </button>
    </form>
  );
}
