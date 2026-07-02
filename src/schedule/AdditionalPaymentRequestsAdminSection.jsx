import { useCallback, useEffect, useState } from "react";
import { formatWon } from "./constants.js";
import {
  approveAdditionalPaymentRequest,
  fetchAdditionalPaymentRequests,
  rejectAdditionalPaymentRequest,
} from "./api.js";

const STATUS_LABEL = {
  pending: "대기중",
  approved: "승인",
  rejected: "반려",
};

export default function AdditionalPaymentRequestsAdminSection({
  yearMonth,
  reviewerId,
  onSaved,
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

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
    if (!rejectReason.trim()) return alert("반려 사유를 입력하세요.");
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
      alert("반려 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const pending = requests.filter(r => r.status === "pending");
  const processed = requests.filter(r => r.status !== "pending");

  return (
    <section className="sch-table-section sch-additional-request-section">
      <h3>추가수당 신청 목록</h3>
      <p className="sch-muted">
        {yearMonth} 강사 신청 건입니다. 승인 시 해당 월 추가지급에 자동 등록됩니다.
      </p>

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : requests.length === 0 ? (
        <p className="sch-muted">이번 달 신청 내역이 없습니다.</p>
      ) : (
        <>
          {pending.length > 0 ? (
            <>
              <h4 className="sch-additional-request-subtitle">승인 대기 ({pending.length})</h4>
              <ul className="sch-additional-request-list">
                {pending.map(req => (
                  <li key={req.id} className="sch-additional-request-item sch-additional-request-item--pending">
                    <div className="sch-additional-request-main">
                      <span className="sch-additional-request-teacher">
                        {req.teachers?.name ?? "—"}
                      </span>
                      <span className="sch-additional-request-reason">{req.reason}</span>
                      <span className="sch-additional-request-amount">{formatWon(req.amount)}</span>
                    </div>
                    {req.memo ? (
                      <p className="sch-muted sch-additional-request-memo">{req.memo}</p>
                    ) : null}
                    <div className="sch-additional-request-actions">
                      <button
                        type="button"
                        className="sch-btn sch-btn--primary sch-btn--sm"
                        disabled={saving}
                        onClick={() => handleApprove(req.id)}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="sch-btn sch-btn--ghost sch-btn--sm"
                        disabled={saving}
                        onClick={() => {
                          setRejecting(req);
                          setRejectReason("");
                        }}
                      >
                        반려
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {processed.length > 0 ? (
            <>
              <h4 className="sch-additional-request-subtitle">처리 완료</h4>
              <ul className="sch-additional-request-list">
                {processed.map(req => (
                  <li key={req.id} className="sch-additional-request-item">
                    <div className="sch-additional-request-main">
                      <span className={`sch-request-status sch-request-status--${req.status}`}>
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
                      <span className="sch-additional-request-teacher">
                        {req.teachers?.name ?? "—"}
                      </span>
                      <span className="sch-additional-request-reason">{req.reason}</span>
                      <span className="sch-additional-request-amount">{formatWon(req.amount)}</span>
                    </div>
                    {req.status === "rejected" && req.rejection_reason ? (
                      <p className="sch-additional-request-rejection">반려 사유: {req.rejection_reason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}

      {rejecting ? (
        <div className="sch-modal-overlay" onClick={() => setRejecting(null)}>
          <form className="sch-modal sch-form" onClick={e => e.stopPropagation()} onSubmit={handleReject}>
            <h3>신청 반려</h3>
            <p className="sch-muted">
              {rejecting.teachers?.name ?? "—"} · {rejecting.reason} · {formatWon(rejecting.amount)}
            </p>
            <label className="sch-field">
              <span>반려 사유</span>
              <textarea
                className="sch-input"
                required
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="강사에게 전달될 반려 사유"
              />
            </label>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setRejecting(null)}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "처리 중..." : "반려"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
