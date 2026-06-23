import { useState } from "react";
import { Trash2 } from "lucide-react";
import { formatWon } from "./constants.js";
import { formatAdditionalPaymentLine, findFixedMonthlySalary } from "./additionalPayments.js";
import { deleteAdditionalPayment, insertAdditionalPayment } from "./api.js";

export default function AdditionalPaymentsAdminSection({
  yearMonth,
  teachers,
  payments,
  createdById,
  onSaved,
}) {
  const [form, setForm] = useState({ teacher_id: "", reason: "", amount: "" });
  const [saving, setSaving] = useState(false);

  const teacherList = teachers.filter(t => t.role === "teacher");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.teacher_id) return alert("강사를 선택해주세요.");
    if (!form.reason.trim()) return alert("사유를 입력해주세요.");
    if (!amount || amount <= 0) return alert("1원 이상 입력해주세요.");
    setSaving(true);
    try {
      await insertAdditionalPayment({
        teacher_id: form.teacher_id,
        year_month: yearMonth,
        amount,
        reason: form.reason.trim(),
        created_by: createdById,
      });
      setForm({ teacher_id: form.teacher_id, reason: "", amount: "" });
      await onSaved();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("이 추가 지급 항목을 삭제할까요?")) return;
    setSaving(true);
    try {
      await deleteAdditionalPayment(id);
      await onSaved();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...payments].sort((a, b) => {
    const ta = teacherList.find(t => t.id === a.teacher_id)?.name ?? "";
    const tb = teacherList.find(t => t.id === b.teacher_id)?.name ?? "";
    return ta.localeCompare(tb, "ko") || a.created_at.localeCompare(b.created_at);
  });

  return (
    <section className="sch-table-section">
      <h3>추가 지급</h3>
      <p className="sch-muted">
        선택한 월({yearMonth})에 강사별 추가 지급을 등록합니다. 강사 예상 급여에 합산됩니다.
        {teacherList.some(t => findFixedMonthlySalary(t.id)) ? (
          <> 고정급 강사(오주영: 월 260만원)는 추가지급만 등록하세요 — 사유 예: <strong>추가근로수당</strong>.</>
        ) : null}
      </p>

      <form className="sch-form sch-additional-pay-form" onSubmit={handleSubmit}>
        <label className="sch-field">
          <span>강사</span>
          <select
            className="sch-select"
            required
            value={form.teacher_id}
            onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
          >
            <option value="">선택</option>
            {teacherList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="sch-field">
          <span>사유</span>
          <input
            type="text"
            className="sch-input"
            required
            placeholder="예: 교통비 지원"
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
        <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
          {saving ? "저장 중..." : "추가"}
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="sch-muted">이번 달 등록된 추가 지급이 없습니다.</p>
      ) : (
        <ul className="sch-additional-pay-list">
          {sorted.map(p => {
            const teacherName = teacherList.find(t => t.id === p.teacher_id)?.name ?? "—";
            return (
              <li key={p.id} className="sch-additional-pay-item">
                <div>
                  <span className="sch-additional-pay-teacher-name">{teacherName}</span>
                  <span className="sch-additional-pay-line">{formatAdditionalPaymentLine(p)}</span>
                </div>
                <button
                  type="button"
                  className="sch-icon-btn"
                  disabled={saving}
                  onClick={() => handleDelete(p.id)}
                  aria-label="삭제"
                >
                  <Trash2 size={14}/>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
