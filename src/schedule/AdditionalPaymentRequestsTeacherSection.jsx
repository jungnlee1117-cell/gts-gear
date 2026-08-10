import { useCallback, useEffect, useState } from "react";
import { formatWon } from "./constants.js";
import { fetchAdditionalPaymentRequests } from "./api.js";
import { getRequestKindMeta } from "./additionalRequestDisplay.js";
import PayrollUnifiedAddForm from "./PayrollUnifiedAddForm.jsx";

const STATUS_LABEL = {
  pending: "대기",
  approved: "승인",
  rejected: "거절",
};

function formatRequestDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  if (!y || !m || !d) return dateStr;
  return `${Number(m)}/${Number(d)}`;
}

function formatRequestTime(start, end) {
  const s = start ? String(start).slice(0, 5) : "";
  const e = end ? String(end).slice(0, 5) : "";
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return "—";
}

/**
 * 수업·추가수당·비용 통합 등록 + 신청 내역
 */
export default function AdditionalPaymentRequestsTeacherSection({
  teacherId,
  teacherName = "",
  yearMonth,
  defaultDate = "",
  institutions = [],
  rates = [],
  busyRanges = [],
  skipPush = false,
  autoApproveExpense = false,
  reviewerId = null,
  isInstitutionLocked = () => false,
  onPayrollChanged,
  readOnly = false,
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAdditionalPaymentRequests({ teacherId, yearMonth });
      setRequests(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teacherId, yearMonth]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = async ({ mode } = {}) => {
    await load();
    if (mode === "immediate") {
      await onPayrollChanged?.();
    }
  };

  return (
    <section className="sch-table-section sch-additional-request-section sch-unified-extra-section">
      <div className="sch-section-header-row">
        <h3>수업·추가수당·비용 등록</h3>
        {!readOnly ? (
          <button
            type="button"
            className="sch-btn sch-btn--ghost sch-btn--sm"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "폼 접기" : "등록하기"}
          </button>
        ) : null}
      </div>
      <p className="sch-muted">
        {autoApproveExpense
          ? "수업은 바로 급여에 반영됩니다. 비용은 슈퍼관리자 등록 시 승인 없이 추가지급에 바로 반영됩니다."
          : skipPush
            ? "수업은 바로 급여에 반영됩니다. 비용(식비·교통비 등)은 신청 후 관리자 승인 시 추가지급에 반영됩니다."
            : "수업은 바로 급여에 반영되고 슈퍼관리자에게 알림이 갑니다. 비용은 신청 후 관리자 승인 시 추가지급에 반영됩니다."}
      </p>

      {showForm && !readOnly ? (
        <PayrollUnifiedAddForm
          teacherId={teacherId}
          teacherName={teacherName}
          yearMonth={yearMonth}
          defaultDate={defaultDate}
          institutions={institutions}
          rates={rates}
          busyRanges={busyRanges}
          skipPush={skipPush}
          autoApproveExpense={autoApproveExpense}
          reviewerId={reviewerId}
          isInstitutionLocked={isInstitutionLocked}
          onSaved={handleSaved}
        />
      ) : null}

      <h4 className="sch-additional-request-subtitle">비용·추가수당 신청 내역</h4>
      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : requests.length === 0 ? (
        <p className="sch-muted">이번 달 신청 내역이 없습니다.</p>
      ) : (
        <ul className="sch-additional-request-list">
          {requests.map((req) => {
            const kind = getRequestKindMeta(req);
            return (
              <li key={req.id} className="sch-additional-request-item">
                <div className="sch-additional-request-main">
                  <span className={`sch-request-status sch-request-status--${req.status}`}>
                    {STATUS_LABEL[req.status] ?? req.status}
                  </span>
                  <span className={`sch-request-kind sch-request-kind--${kind.kind}`}>
                    {kind.label}
                  </span>
                  {kind.kind === "expense" ? (
                    <span className="sch-request-expense-type">{kind.typeLabel}</span>
                  ) : null}
                  <span className="sch-additional-request-meta">
                    <span>{formatRequestDate(req.event_date)}</span>
                    {kind.kind !== "expense" ? (
                      <>
                        <span className="sch-additional-request-sep">·</span>
                        <span>{formatRequestTime(req.start_time, req.end_time)}</span>
                        <span className="sch-additional-request-sep">·</span>
                        <span className="sch-additional-request-location">
                          {req.location?.trim() || "—"}
                        </span>
                      </>
                    ) : null}
                  </span>
                  <span className="sch-additional-request-amount">{formatWon(req.amount)}</span>
                </div>
                {kind.kind === "expense" && req.memo ? (
                  <p className="sch-muted sch-additional-request-memo">세부: {req.memo}</p>
                ) : null}
                {kind.kind !== "expense" && req.reason ? (
                  <p className="sch-muted sch-additional-request-memo">사유: {req.reason}</p>
                ) : null}
                {kind.kind !== "expense" && req.memo ? (
                  <p className="sch-muted sch-additional-request-memo">메모: {req.memo}</p>
                ) : null}
                {req.receipt_url ? (
                  <p className="sch-additional-request-receipt">
                    <a href={req.receipt_url} target="_blank" rel="noreferrer">영수증 보기</a>
                  </p>
                ) : null}
                {req.status === "rejected" && (req.rejection_reason || req.rejected_reason) ? (
                  <p className="sch-additional-request-rejection">
                    거절 사유: {req.rejection_reason || req.rejected_reason}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
