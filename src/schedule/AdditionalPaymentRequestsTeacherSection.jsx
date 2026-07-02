import { useCallback, useEffect, useState } from "react";
import { formatWon } from "./constants.js";
import {
  fetchAdditionalPaymentRequests,
  insertAdditionalPaymentRequest,
} from "./api.js";

const STATUS_LABEL = {
  pending: "대기중",
  approved: "승인",
  rejected: "반려",
};

export default function AdditionalPaymentRequestsTeacherSection({
  teacherId,
  yearMonth,
  readOnly = false,
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reason: "", amount: "", memo: "" });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.reason.trim()) return alert("사유를 입력해주세요.");
    if (!amount || amount <= 0) return alert("1원 이상 입력해주세요.");
    setSaving(true);
    try {
      await insertAdditionalPaymentRequest({
        teacher_id: teacherId,
        year_month: yearMonth,
        amount,
        reason: form.reason.trim(),
        memo: form.memo,
      });
      setForm({ reason: "", amount: "", memo: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      alert("신청 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sch-table-section sch-additional-request-section">
      <div className="sch-section-header-row">
        <h3>추가수당 신청</h3>
        {!readOnly ? (
          <button
            type="button"
            className="sch-btn sch-btn--primary sch-btn--sm"
            onClick={() => setShowForm(v => !v)}
          >
            {showForm ? "닫기" : "추가수당 신청"}
          </button>
        ) : null}
      </div>
      <p className="sch-muted">
        승인 전까지는 예상 급여에 반영되지 않습니다. 승인되면 해당 월 추가지급에 자동 등록됩니다.
      </p>

      {showForm && !readOnly ? (
        <form className="sch-form sch-additional-request-form" onSubmit={handleSubmit}>
          <label className="sch-field">
            <span>사유</span>
            <input
              type="text"
              className="sch-input"
              required
              placeholder="예: 추가 근무 수당"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </label>
          <label className="sch-field">
            <span>금액 (원)</span>
            <input
              type="number"
              className="sch-input"
              min={1}
              required
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </label>
          <label className="sch-field">
            <span>메모 (선택)</span>
            <input
              type="text"
              className="sch-input"
              placeholder="상세 설명"
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
            />
          </label>
          <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
            {saving ? "신청 중..." : "신청하기"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : requests.length === 0 ? (
        <p className="sch-muted">이번 달 신청 내역이 없습니다.</p>
      ) : (
        <ul className="sch-additional-request-list">
          {requests.map(req => (
            <li key={req.id} className="sch-additional-request-item">
              <div className="sch-additional-request-main">
                <span className={`sch-request-status sch-request-status--${req.status}`}>
                  {STATUS_LABEL[req.status] ?? req.status}
                </span>
                <span className="sch-additional-request-reason">{req.reason}</span>
                <span className="sch-additional-request-amount">{formatWon(req.amount)}</span>
              </div>
              {req.memo ? (
                <p className="sch-muted sch-additional-request-memo">{req.memo}</p>
              ) : null}
              {req.status === "rejected" && req.rejection_reason ? (
                <p className="sch-additional-request-rejection">반려 사유: {req.rejection_reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
