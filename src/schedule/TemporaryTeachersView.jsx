import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Pencil } from "lucide-react";
import { PAY_TYPES, formatWon } from "./constants.js";
import {
  fetchInstitutions,
  fetchTeachers,
  fetchTemporaryEngagements,
  registerTemporaryTeacher,
  updateTempTeacher,
} from "./api.js";
import { canEditTempTeacher, computeTempTeacherPay, formatShortDateRange, formatTempTeacherPayFormula, formatTempTeacherPaySummary, formatTemporaryTeacherSettlementLabel, TEMP_TEACHER_PAY_MODE_LABELS } from "./temporaryTeachers.js";

const EMPTY_FORM = {
  name: "",
  phone: "",
  bank_name: "",
  bank_account: "",
  institution_id: "",
  pay_mode: "hourly",
  rate_amount: "",
  work_hours: "",
  work_days: "",
  pay_type: "정규",
  is_substitute: false,
  substitute_teacher_id: "",
  substitute_start_date: "",
  substitute_end_date: "",
  engagement_start_date: "",
  engagement_end_date: "",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function recordToForm(record) {
  if (!record) return { ...EMPTY_FORM, engagement_start_date: todayISO() };
  return {
    name: record.name || "",
    phone: record.phone || "",
    bank_name: record.bank_name || "",
    bank_account: record.bank_account || "",
    institution_id: record.institution_id || "",
    pay_mode: record.pay_mode === "per_session" ? "hourly" : (record.pay_mode || "hourly"),
    rate_amount: record.rate_amount != null ? String(record.rate_amount) : "",
    work_hours: record.work_hours != null ? String(record.work_hours) : "",
    work_days: record.work_days != null ? String(record.work_days) : "",
    pay_type: record.pay_type || "정규",
    is_substitute: Boolean(record.is_substitute),
    substitute_teacher_id: record.substitute_teacher_id || "",
    substitute_start_date: record.substitute_start_date?.slice(0, 10) || "",
    substitute_end_date: record.substitute_end_date?.slice(0, 10) || "",
    engagement_start_date: record.engagement_start_date?.slice(0, 10) || "",
    engagement_end_date: record.engagement_end_date?.slice(0, 10) || "",
  };
}

export default function TemporaryTeachersView({ me, onBack }) {
  const [institutions, setInstitutions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, engagement_start_date: todayISO() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insts, tchs, engs] = await Promise.all([
        fetchInstitutions(),
        fetchTeachers(),
        fetchTemporaryEngagements(),
      ]);
      setInstitutions(insts);
      setTeachers(tchs);
      setEngagements(engs);
    } catch (e) {
      console.error(e);
      alert(e.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const institutionMap = useMemo(() => {
    const m = {};
    institutions.forEach(i => { m[i.id] = i; });
    return m;
  }, [institutions]);

  const substituteCandidates = useMemo(
    () => teachers.filter(t => t.role === "teacher"),
    [teachers],
  );

  const engagementRows = useMemo(() =>
    engagements.map(eng => ({
      ...eng,
      institution: institutionMap[eng.institution_id],
      label: formatTemporaryTeacherSettlementLabel(eng, institutionMap[eng.institution_id], teachers),
      payLabel: formatTempTeacherPaySummary(eng).label,
      payTotal: computeTempTeacherPay(eng),
      period: formatShortDateRange(eng.engagement_start_date, eng.engagement_end_date),
      bankLabel: [eng.bank_name, eng.bank_account].filter(Boolean).join(" ") || "—",
      canEdit: canEditTempTeacher(me, eng),
    })),
  [engagements, institutionMap, teachers, me]);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, engagement_start_date: todayISO() });
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, engagement_start_date: todayISO() });
    setShowForm(true);
  };

  const openEdit = (record) => {
    if (!canEditTempTeacher(me, record)) {
      alert("수정 권한이 없습니다.");
      return;
    }
    setEditingId(record.id);
    setForm(recordToForm(record));
    setShowForm(true);
  };

  const payPreview = useMemo(() => {
    const eng = {
      pay_mode: form.pay_mode,
      rate_amount: form.rate_amount,
      work_hours: form.work_hours,
      work_days: form.work_days,
    };
    return {
      total: computeTempTeacherPay(eng),
      formula: formatTempTeacherPayFormula(eng),
    };
  }, [form.pay_mode, form.rate_amount, form.work_hours, form.work_days]);

  const buildPayload = () => ({
    name: form.name.trim(),
    phone: form.phone.trim(),
    bank_name: form.bank_name.trim(),
    bank_account: form.bank_account.trim(),
    institution_id: form.institution_id,
    pay_mode: form.pay_mode,
    rate_amount: Number(form.rate_amount),
    work_hours: form.pay_mode === "hourly" ? Number(form.work_hours) : null,
    work_days: form.pay_mode === "daily" ? Number(form.work_days) : null,
    pay_type: form.pay_type,
    is_substitute: form.is_substitute,
    substitute_teacher_id: form.is_substitute ? form.substitute_teacher_id : null,
    substitute_start_date: form.is_substitute ? form.substitute_start_date : null,
    substitute_end_date: form.is_substitute ? form.substitute_end_date : null,
    engagement_start_date: form.engagement_start_date,
    engagement_end_date: form.engagement_end_date || null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("이름을 입력해주세요.");
    if (!form.institution_id) return alert("기관을 선택해주세요.");
    if (!form.engagement_start_date) return alert("근무 시작일을 입력해주세요.");
    if (form.pay_mode === "hourly") {
      if (!form.rate_amount || Number(form.rate_amount) <= 0) return alert("시급을 입력해주세요.");
      if (!form.work_hours || Number(form.work_hours) <= 0) return alert("근무 시간을 입력해주세요.");
    } else if (form.pay_mode === "daily") {
      if (!form.rate_amount || Number(form.rate_amount) <= 0) return alert("일급을 입력해주세요.");
      if (!form.work_days || Number(form.work_days) <= 0) return alert("근무 일수를 입력해주세요.");
    } else if (form.pay_mode === "fixed_total") {
      if (!form.rate_amount || Number(form.rate_amount) <= 0) return alert("총금액을 입력해주세요.");
    }
    if (form.is_substitute) {
      if (!form.substitute_teacher_id) return alert("대체 대상 선생님을 선택해주세요.");
      if (!form.substitute_start_date || !form.substitute_end_date) {
        return alert("대체 기간(시작일~종료일)을 입력해주세요.");
      }
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await updateTempTeacher(editingId, payload);
        alert("수정되었습니다.");
      } else {
        await registerTemporaryTeacher({ ...payload, created_by: me?.id });
        alert("임시 선생님이 등록되었습니다.");
      }
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || (editingId ? "수정 실패" : "등록 실패"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 급여/정산
        </button>
        <h2 className="sch-view-title">임시 선생님 등록</h2>
        <div className="sch-header-actions">
          <button
            type="button"
            className="sch-btn sch-btn--primary"
            onClick={() => (showForm ? resetForm() : openCreate())}
          >
            {showForm ? "취소" : "+ 임시 선생님 등록"}
          </button>
        </div>
      </header>

      <p className="sch-muted sch-view-desc">
        로그인 계정 없이 정산용 인력 정보만 등록합니다. 급여는 시급·일급·총금액 중 선택해 입력하며, 등록 후에도 수정할 수 있습니다.
      </p>

      {showForm ? (
        <form className="sch-form sch-form--stacked sch-temp-teacher-form" onSubmit={handleSubmit}>
          <h3 className="sch-form-section-title">
            {editingId ? "임시 선생님 수정" : "임시 선생님 등록"}
          </h3>
          <div className="sch-form-row">
            <label className="sch-field">
              <span>이름</span>
              <input
                className="sch-input"
                value={form.name}
                onChange={e => setField("name", e.target.value)}
                required
              />
            </label>
            <label className="sch-field">
              <span>연락처</span>
              <input
                className="sch-input"
                value={form.phone}
                onChange={e => setField("phone", e.target.value)}
                placeholder="선택"
              />
            </label>
          </div>
          <div className="sch-form-row">
            <label className="sch-field">
              <span>은행명</span>
              <input
                className="sch-input"
                value={form.bank_name}
                onChange={e => setField("bank_name", e.target.value)}
                placeholder="예: 국민은행"
              />
            </label>
            <label className="sch-field">
              <span>계좌번호</span>
              <input
                className="sch-input"
                value={form.bank_account}
                onChange={e => setField("bank_account", e.target.value)}
                placeholder="- 없이 입력"
              />
            </label>
          </div>

          <h3 className="sch-form-section-title">근무 · 정산</h3>
          <div className="sch-form-row">
            <label className="sch-field">
              <span>기관</span>
              <select
                className="sch-input"
                value={form.institution_id}
                onChange={e => setField("institution_id", e.target.value)}
                required
              >
                <option value="">선택</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </label>
            <label className="sch-field">
              <span>수업 유형</span>
              <select
                className="sch-input"
                value={form.pay_type}
                onChange={e => setField("pay_type", e.target.value)}
              >
                {PAY_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="sch-form-row">
            <label className="sch-field">
              <span>급여 방식</span>
              <div className="sch-chip-row">
                {["hourly", "daily", "fixed_total"].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    className={`sch-chip${form.pay_mode === mode ? " active" : ""}`}
                    onClick={() => setField("pay_mode", mode)}
                  >
                    {TEMP_TEACHER_PAY_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </label>
          </div>

          {form.pay_mode === "hourly" ? (
            <div className="sch-form-row">
              <label className="sch-field">
                <span>시급 (원)</span>
                <input
                  type="number"
                  className="sch-input"
                  min="1"
                  value={form.rate_amount}
                  onChange={e => setField("rate_amount", e.target.value)}
                  required
                />
              </label>
              <label className="sch-field">
                <span>근무 시간</span>
                <input
                  type="number"
                  className="sch-input"
                  min="0.5"
                  step="0.5"
                  value={form.work_hours}
                  onChange={e => setField("work_hours", e.target.value)}
                  placeholder="예: 12"
                  required
                />
              </label>
            </div>
          ) : null}

          {form.pay_mode === "daily" ? (
            <div className="sch-form-row">
              <label className="sch-field">
                <span>일급 (원)</span>
                <input
                  type="number"
                  className="sch-input"
                  min="1"
                  value={form.rate_amount}
                  onChange={e => setField("rate_amount", e.target.value)}
                  required
                />
              </label>
              <label className="sch-field">
                <span>근무 일수</span>
                <input
                  type="number"
                  className="sch-input"
                  min="1"
                  step="1"
                  value={form.work_days}
                  onChange={e => setField("work_days", e.target.value)}
                  placeholder="예: 5"
                  required
                />
              </label>
            </div>
          ) : null}

          {form.pay_mode === "fixed_total" ? (
            <div className="sch-form-row">
              <label className="sch-field">
                <span>총금액 (원)</span>
                <input
                  type="number"
                  className="sch-input"
                  min="1"
                  value={form.rate_amount}
                  onChange={e => setField("rate_amount", e.target.value)}
                  required
                />
              </label>
            </div>
          ) : null}

          {payPreview.total > 0 ? (
            <p className="sch-temp-pay-preview">
              예상 급여: <strong>{formatWon(payPreview.total)}</strong>
              <span className="sch-muted"> ({payPreview.formula})</span>
            </p>
          ) : null}

          <div className="sch-form-row">
            <label className="sch-field">
              <span>근무 시작일</span>
              <input
                type="date"
                className="sch-input"
                value={form.engagement_start_date}
                onChange={e => setField("engagement_start_date", e.target.value)}
                required
              />
            </label>
            <label className="sch-field">
              <span>근무 종료일</span>
              <input
                type="date"
                className="sch-input"
                value={form.engagement_end_date}
                onChange={e => setField("engagement_end_date", e.target.value)}
                placeholder="미정 시 비움"
              />
            </label>
          </div>

          <label className="sch-field sch-field--checkbox">
            <input
              type="checkbox"
              checked={form.is_substitute}
              onChange={e => setField("is_substitute", e.target.checked)}
            />
            <span>대체 근무</span>
          </label>

          {form.is_substitute ? (
            <div className="sch-form-subsection">
              <label className="sch-field">
                <span>대체 대상 선생님</span>
                <select
                  className="sch-input"
                  value={form.substitute_teacher_id}
                  onChange={e => setField("substitute_teacher_id", e.target.value)}
                  required
                >
                  <option value="">선택</option>
                  {substituteCandidates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <div className="sch-form-row">
                <label className="sch-field">
                  <span>대체 시작일</span>
                  <input
                    type="date"
                    className="sch-input"
                    value={form.substitute_start_date}
                    onChange={e => setField("substitute_start_date", e.target.value)}
                    required
                  />
                </label>
                <label className="sch-field">
                  <span>대체 종료일</span>
                  <input
                    type="date"
                    className="sch-input"
                    value={form.substitute_end_date}
                    onChange={e => setField("substitute_end_date", e.target.value)}
                    required
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className="sch-form-actions">
            <button type="button" className="sch-btn sch-btn--ghost" onClick={resetForm}>
              취소
            </button>
            <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
              {saving ? "저장 중…" : editingId ? "수정 저장" : "등록"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="sch-admin-dash-section">
        <h3 className="sch-admin-dash-section-title">등록된 임시 선생님</h3>
        {loading ? (
          <p className="sch-muted">불러오는 중…</p>
        ) : engagementRows.length === 0 ? (
          <p className="sch-muted">등록된 임시 선생님이 없습니다.</p>
        ) : (
          <div className="sch-table-wrap">
            <table className="sch-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>정산 표시</th>
                  <th>계좌</th>
                  <th>급여</th>
                  <th>근무 기간</th>
                  <th aria-label="수정"/>
                </tr>
              </thead>
              <tbody>
                {engagementRows.map(row => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.label}</td>
                    <td>{row.bankLabel}</td>
                    <td>
                      <div>{row.payLabel}</div>
                      {row.payTotal > 0 ? (
                        <div className="sch-muted" style={{ fontSize: 12 }}>{formatWon(row.payTotal)}</div>
                      ) : null}
                    </td>
                    <td>{row.period || "—"}</td>
                    <td>
                      {row.canEdit ? (
                        <button
                          type="button"
                          className="sch-btn sch-btn--ghost sch-btn--icon"
                          onClick={() => openEdit(row)}
                          title="수정"
                        >
                          <Pencil size={15}/>
                        </button>
                      ) : (
                        <span className="sch-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
