import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatAdditionalPaymentLine, findFixedMonthlySalary } from "./additionalPayments.js";
import {
  deleteAdditionalPayment,
  insertAdditionalPayment,
  updateAdditionalPayment,
} from "./api.js";

function paymentYearMonthLabel(payment) {
  return String(payment.year_month || "").slice(0, 7) || "—";
}

function paymentYearMonthValue(payment, fallback) {
  return String(payment.year_month || "").slice(0, 7) || fallback;
}

function paymentMetaLine(payment) {
  return `${paymentYearMonthLabel(payment)} · ${formatAdditionalPaymentLine(payment)}`;
}

export default function AdditionalPaymentsAdminSection({
  yearMonth,
  teachers,
  allTeachers,
  payments,
  createdById,
  isSuperAdmin = false,
  onSaved,
}) {
  const [form, setForm] = useState({
    teacher_id: "",
    reason: "",
    amount: "",
    year_month: yearMonth,
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const teacherList = useMemo(
    () => teachers.filter(t => t.role === "teacher"),
    [teachers],
  );
  const nameLookup = allTeachers?.length ? allTeachers : teachers;
  const manageableTeacherIds = useMemo(
    () => new Set(teacherList.map(t => t.id)),
    [teacherList],
  );

  useEffect(() => {
    setForm(f => ({ ...f, year_month: yearMonth }));
  }, [yearMonth]);

  const canManage = (payment) => manageableTeacherIds.has(payment.teacher_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.teacher_id) return alert("강사를 선택해주세요.");
    if (!form.reason.trim()) return alert("사유를 입력해주세요.");
    if (!amount || amount <= 0) return alert("1원 이상 입력해주세요.");
    if (!form.year_month) return alert("연월을 선택해주세요.");
    setSaving(true);
    try {
      await insertAdditionalPayment({
        teacher_id: form.teacher_id,
        year_month: form.year_month,
        amount,
        reason: form.reason.trim(),
        created_by: createdById,
      });
      setForm({
        teacher_id: form.teacher_id,
        reason: "",
        amount: "",
        year_month: yearMonth,
      });
      await onSaved();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (payment) => {
    if (!canManage(payment)) return;
    setEditing({
      id: payment.id,
      teacher_id: payment.teacher_id,
      reason: payment.reason,
      amount: String(payment.amount),
      year_month: paymentYearMonthValue(payment, yearMonth),
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    const amount = Number(editing.amount);
    if (!editing.reason.trim()) return alert("사유를 입력해주세요.");
    if (!amount || amount <= 0) return alert("1원 이상 입력해주세요.");
    if (!editing.year_month) return alert("연월을 선택해주세요.");
    setSaving(true);
    try {
      await updateAdditionalPayment(editing.id, {
        amount,
        reason: editing.reason.trim(),
        year_month: editing.year_month,
      });
      setEditing(null);
      await onSaved();
    } catch (err) {
      alert("수정 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (payment) => {
    if (!canManage(payment)) return;
    if (!confirm("이 추가 지급 항목을 삭제할까요?")) return;
    setSaving(true);
    try {
      await deleteAdditionalPayment(payment.id);
      await onSaved();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...payments].sort((a, b) => {
    const ta = nameLookup.find(t => t.id === a.teacher_id)?.name ?? "";
    const tb = nameLookup.find(t => t.id === b.teacher_id)?.name ?? "";
    const monthCmp = paymentYearMonthLabel(b).localeCompare(paymentYearMonthLabel(a));
    return ta.localeCompare(tb, "ko") || monthCmp || String(a.reason).localeCompare(String(b.reason), "ko");
  });

  return (
    <section className="sch-table-section">
      <h3>추가 지급</h3>
      <p className="sch-muted">
        강사별 추가 지급을 등록·수정합니다. 아래 목록은 상단에서 선택한 월({yearMonth}) 기준입니다.
        {isSuperAdmin ? " 슈퍼관리자는 전체 강사, 일반 관리자는 담당 강사만 등록·수정할 수 있습니다." : " 담당 강사만 등록·수정할 수 있습니다."}
        {teacherList.some(t => findFixedMonthlySalary(t.id)) ? (
          <> 고정급 강사(오주영: 월 260만원)는 추가지급만 등록하세요 — 사유 예: <strong>추가근로수당</strong>.</>
        ) : null}
      </p>

      <form className="sch-form sch-additional-pay-form sch-additional-pay-form--extended" onSubmit={handleSubmit}>
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
          <span>연월</span>
          <input
            type="month"
            className="sch-input"
            required
            value={form.year_month}
            onChange={e => setForm(f => ({ ...f, year_month: e.target.value }))}
          />
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
          {saving ? "저장 중..." : "등록"}
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="sch-muted">이번 달 등록된 추가 지급이 없습니다.</p>
      ) : (
        <ul className="sch-additional-pay-list">
          {sorted.map(p => {
            const teacherName = nameLookup.find(t => t.id === p.teacher_id)?.name ?? "—";
            const manageable = canManage(p);
            return (
              <li key={p.id} className="sch-additional-pay-item">
                <div>
                  <span className="sch-additional-pay-teacher-name">{teacherName}</span>
                  <span className="sch-additional-pay-line">{paymentMetaLine(p)}</span>
                </div>
                {manageable ? (
                  <div className="sch-additional-pay-actions">
                    <button
                      type="button"
                      className="sch-icon-btn"
                      disabled={saving}
                      onClick={() => openEdit(p)}
                      aria-label="수정"
                      title="수정"
                    >
                      <Pencil size={14}/>
                    </button>
                    <button
                      type="button"
                      className="sch-icon-btn"
                      disabled={saving}
                      onClick={() => handleDelete(p)}
                      aria-label="삭제"
                      title="삭제"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <div className="sch-modal-overlay" onClick={() => setEditing(null)}>
          <form className="sch-modal sch-form" onClick={e => e.stopPropagation()} onSubmit={handleEditSave}>
            <h3>추가 지급 수정</h3>
            <p className="sch-muted">
              {nameLookup.find(t => t.id === editing.teacher_id)?.name ?? "—"}
            </p>
            <label className="sch-field">
              <span>연월</span>
              <input
                type="month"
                className="sch-input"
                required
                value={editing.year_month}
                onChange={e => setEditing(ed => ({ ...ed, year_month: e.target.value }))}
              />
            </label>
            <label className="sch-field">
              <span>사유</span>
              <input
                type="text"
                className="sch-input"
                required
                value={editing.reason}
                onChange={e => setEditing(ed => ({ ...ed, reason: e.target.value }))}
              />
            </label>
            <label className="sch-field">
              <span>금액 (원)</span>
              <input
                type="number"
                className="sch-input"
                min={1}
                required
                value={editing.amount}
                onChange={e => setEditing(ed => ({ ...ed, amount: e.target.value }))}
              />
            </label>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setEditing(null)}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
