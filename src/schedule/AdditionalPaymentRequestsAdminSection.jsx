import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Wallet } from "lucide-react";
import { formatWon } from "./constants.js";
import {
  approveAdditionalPaymentRequest,
  fetchAdditionalPaymentRequests,
  rejectAdditionalPaymentRequest,
} from "./api.js";
import { getRequestKindMeta, summarizePaymentRequests } from "./additionalRequestDisplay.js";

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

function RequestCard({
  req,
  showTeacher = false,
  showActions = false,
  saving = false,
  onApprove,
  onReject,
}) {
  const kind = getRequestKindMeta(req);
  return (
    <li className={`sch-request-card${req.status === "pending" ? " sch-request-card--pending" : ""}`}>
      <div className="sch-request-card-top">
        <div className="sch-request-card-badges">
          <span className={`sch-request-status sch-request-status--${req.status}`}>
            {STATUS_LABEL[req.status] ?? req.status}
          </span>
          <span className={`sch-request-kind sch-request-kind--${kind.kind}`}>
            {kind.label}
          </span>
          {kind.kind === "expense" ? (
            <span className="sch-request-expense-type">{kind.typeLabel}</span>
          ) : null}
        </div>
        <span className="sch-request-card-amount">{formatWon(req.amount)}</span>
      </div>

      <div className="sch-request-card-body">
        {showTeacher ? (
          <div className="sch-request-card-teacher">{req.teachers?.name ?? "—"}</div>
        ) : null}
        <div className="sch-request-card-meta">
          <span>{formatRequestDate(req.event_date)}</span>
          {kind.kind !== "expense" ? (
            <>
              <span className="sch-additional-request-sep">·</span>
              <span>{formatRequestTime(req.start_time, req.end_time)}</span>
              <span className="sch-additional-request-sep">·</span>
              <span>{req.location?.trim() || "—"}</span>
            </>
          ) : null}
        </div>

        {kind.kind === "expense" && req.memo ? (
          <p className="sch-request-card-detail">세부: {req.memo}</p>
        ) : null}
        {kind.kind !== "expense" && req.reason ? (
          <p className="sch-request-card-detail">사유: {req.reason}</p>
        ) : null}
        {kind.kind !== "expense" && req.memo ? (
          <p className="sch-request-card-detail">메모: {req.memo}</p>
        ) : null}

        {req.receipt_url ? (
          <div className="sch-expense-receipt-admin">
            <a href={req.receipt_url} target="_blank" rel="noreferrer">
              <img src={req.receipt_url} alt="영수증" className="sch-expense-receipt-thumb" />
            </a>
            <a href={req.receipt_url} target="_blank" rel="noreferrer" className="sch-link">
              영수증 원본 보기
            </a>
          </div>
        ) : kind.kind === "expense" ? (
          <p className="sch-muted sch-additional-request-memo">영수증 없음</p>
        ) : null}

        {req.status === "rejected" && (req.rejection_reason || req.rejected_reason) ? (
          <p className="sch-additional-request-rejection">
            거절 사유: {req.rejection_reason || req.rejected_reason}
          </p>
        ) : null}
      </div>

      {showActions ? (
        <div className="sch-request-card-actions">
          <button
            type="button"
            className="sch-btn sch-btn--primary sch-btn--sm"
            disabled={saving}
            onClick={() => onApprove?.(req.id)}
          >
            승인
          </button>
          <button
            type="button"
            className="sch-btn sch-btn--ghost sch-btn--sm"
            disabled={saving}
            onClick={() => onReject?.(req)}
          >
            거절
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default function AdditionalPaymentRequestsAdminSection({
  yearMonth,
  reviewerId,
  onSaved,
  onStatsChange,
  sectionId = "sch-admin-section-requests",
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAdditionalPaymentRequests({ yearMonth });
      setRequests(rows);
      onStatsChange?.(summarizePaymentRequests(rows));
    } catch (err) {
      console.error(err);
      setRequests([]);
      onStatsChange?.(summarizePaymentRequests([]));
      alert("신청 목록을 불러오지 못했습니다: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [yearMonth, onStatsChange]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    if (!confirm("이 신청을 승인하고 추가지급에 반영할까요?")) return;
    setSaving(true);
    try {
      await approveAdditionalPaymentRequest(id, {
        reviewed_by: reviewerId,
        created_by: reviewerId,
      });
      await load();
      await onSaved?.();
    } catch (err) {
      alert("승인 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return alert("거절 사유를 입력하세요.");
    setSaving(true);
    try {
      await rejectAdditionalPaymentRequest(rejecting.id, {
        reviewed_by: reviewerId,
        rejection_reason: rejectReason.trim(),
      });
      setRejecting(null);
      setRejectReason("");
      await load();
    } catch (err) {
      alert("거절 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const pending = useMemo(() => requests.filter(r => r.status === "pending"), [requests]);
  const processed = useMemo(() => requests.filter(r => r.status !== "pending"), [requests]);
  const stats = useMemo(() => summarizePaymentRequests(requests), [requests]);
  const hasAlert = stats.pendingTotal > 0;

  return (
    <section
      id={sectionId}
      className={[
        "sch-admin-dash-section",
        "sch-additional-request-section",
        "sch-admin-dash-section--requests",
        hasAlert ? "sch-admin-dash-section--alert" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="sch-admin-section-head">
        <div className="sch-admin-section-head-main">
          <span className="sch-admin-section-icon sch-admin-section-icon--wallet" aria-hidden>
            <Wallet size={18} />
          </span>
          <div>
            <h3 className="sch-admin-dash-section-title">
              추가수당·비용 신청 목록
              {hasAlert ? <span className="sch-admin-section-alert-dot" aria-hidden /> : null}
            </h3>
            <p className="sch-muted sch-admin-dash-section-desc">
              {yearMonth} 강사 신청 건입니다. 승인 시 해당 월 추가지급에 자동 등록됩니다.
            </p>
          </div>
        </div>
        <div className="sch-admin-section-badges">
          {hasAlert ? (
            <span className="sch-admin-count-badge sch-admin-count-badge--danger">
              <AlertCircle size={13} aria-hidden />
              {stats.pendingTotal}건 대기중
            </span>
          ) : (
            <span className="sch-admin-count-badge sch-admin-count-badge--ok">
              <Check size={13} aria-hidden />
              대기 없음
            </span>
          )}
          {stats.pendingExpense > 0 ? (
            <span className="sch-admin-count-badge sch-admin-count-badge--expense">
              비용 {stats.pendingExpense}
            </span>
          ) : null}
          {stats.pendingAllowance > 0 ? (
            <span className="sch-admin-count-badge sch-admin-count-badge--allowance">
              추가수당 {stats.pendingAllowance}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : requests.length === 0 ? (
        <p className="sch-muted">이번 달 신청 내역이 없습니다.</p>
      ) : (
        <>
          {pending.length > 0 ? (
            <>
              <h4 className="sch-additional-request-subtitle">승인 대기 ({pending.length})</h4>
              <ul className="sch-request-card-list">
                {pending.map(req => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    showTeacher
                    showActions
                    saving={saving}
                    onApprove={handleApprove}
                    onReject={(r) => {
                      setRejecting(r);
                      setRejectReason("");
                    }}
                  />
                ))}
              </ul>
            </>
          ) : null}

          {processed.length > 0 ? (
            <>
              <h4 className="sch-additional-request-subtitle">처리 완료</h4>
              <ul className="sch-request-card-list">
                {processed.map(req => (
                  <RequestCard key={req.id} req={req} showTeacher />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}

      {rejecting ? (
        <div className="sch-modal-overlay" onClick={() => setRejecting(null)}>
          <form className="sch-modal sch-form" onClick={e => e.stopPropagation()} onSubmit={handleReject}>
            <h3>신청 거절</h3>
            <p className="sch-muted">
              {rejecting.teachers?.name ?? "—"} · {getRequestKindMeta(rejecting).typeLabel} · {formatWon(rejecting.amount)}
            </p>
            <label className="sch-field">
              <span>거절 사유</span>
              <textarea
                className="sch-input"
                required
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="강사에게 전달될 거절 사유"
              />
            </label>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setRejecting(null)}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "처리 중..." : "거절"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
