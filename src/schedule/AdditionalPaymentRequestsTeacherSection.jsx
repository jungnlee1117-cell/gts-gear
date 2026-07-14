import { useCallback, useEffect, useState } from "react";
import { formatWon } from "./constants.js";
import {
  fetchAdditionalPaymentRequests,
  insertAdditionalPaymentRequest,
} from "./api.js";

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

const EMPTY_FORM = {
  event_date: "",
  start_time: "",
  end_time: "",
  location: "",
  memo: "",
  amount: "",
  reason: "",
};

export default function AdditionalPaymentRequestsTeacherSection({
  teacherId,
  yearMonth,
  defaultDate = "",
  readOnly = false,
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    event_date: defaultDate || "",
  }));

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

  useEffect(() => {
    if (!showForm) return;
    setForm(f => (f.event_date ? f : { ...f, event_date: defaultDate || "" }));
  }, [defaultDate, showForm]);

  const openForm = () => {
    setForm({ ...EMPTY_FORM, event_date: defaultDate || "" });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.event_date) return alert("날짜를 선택해주세요.");
    if (!form.start_time || !form.end_time) return alert("시작·종료 시간을 입력해주세요.");
    if (form.start_time >= form.end_time) return alert("종료 시간은 시작 시간보다 늦어야 합니다.");
    if (!form.location.trim()) return alert("수업 장소/기관을 입력해주세요.");
    if (!form.reason.trim()) return alert("신청 사유를 입력해주세요.");
    if (!amount || amount <= 0) return alert("1원 이상 입력해주세요.");
    setSaving(true);
    try {
      await insertAdditionalPaymentRequest({
        teacher_id: teacherId,
        year_month: yearMonth,
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location,
        amount,
        reason: form.reason.trim(),
        memo: form.memo,
      });
      setForm({ ...EMPTY_FORM, event_date: defaultDate || "" });
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
            onClick={() => (showForm ? setShowForm(false) : openForm())}
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
            <span>날짜</span>
            <input
              type="date"
              className="sch-input"
              required
              value={form.event_date}
              onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
            />
          </label>
          <div className="sch-time-row">
            <label className="sch-field">
              <span>시작 시간</span>
              <input
                type="time"
                className="sch-input"
                required
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
              />
            </label>
            <label className="sch-field">
              <span>종료 시간</span>
              <input
                type="time"
                className="sch-input"
                required
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
              />
            </label>
          </div>
          <label className="sch-field">
            <span>수업 장소/기관</span>
            <input
              type="text"
              className="sch-input"
              required
              placeholder="예: 힘멜아카데미, Play by GTS"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            />
          </label>
          <label className="sch-field">
            <span>수업 내용 메모 (선택)</span>
            <input
              type="text"
              className="sch-input"
              placeholder="수업 내용·특이사항"
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
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
            <span>신청 사유</span>
            <input
              type="text"
              className="sch-input"
              required
              placeholder="예: 추가 근무 수당, 특별 수업"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
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
                <span className="sch-additional-request-meta">
                  <span>{formatRequestDate(req.event_date)}</span>
                  <span className="sch-additional-request-sep">·</span>
                  <span>{formatRequestTime(req.start_time, req.end_time)}</span>
                  <span className="sch-additional-request-sep">·</span>
                  <span className="sch-additional-request-location">
                    {req.location?.trim() || "—"}
                  </span>
                </span>
                <span className="sch-additional-request-amount">{formatWon(req.amount)}</span>
              </div>
              {req.reason ? (
                <p className="sch-muted sch-additional-request-memo">사유: {req.reason}</p>
              ) : null}
              {req.memo ? (
                <p className="sch-muted sch-additional-request-memo">메모: {req.memo}</p>
              ) : null}
              {req.status === "rejected" && req.rejection_reason ? (
                <p className="sch-additional-request-rejection">거절 사유: {req.rejection_reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
