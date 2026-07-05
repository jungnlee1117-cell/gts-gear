import { useCallback, useEffect, useMemo, useState } from "react";
import { PAY_TYPES } from "./constants.js";
import {
  fetchInstitutions,
  fetchTeachers,
  fetchTemporaryEngagements,
  registerTemporaryTeacher,
} from "./api.js";
import { registerSubstituteLesson } from "./substituteLessonService.js";
import { timeSlotFromPlanned } from "./substituteLessons.js";

const EMPTY_TEMP_FORM = {
  name: "",
  pay_mode: "hourly",
  rate_amount: "",
  work_hours: "",
};

export default function SubstituteLessonModal({
  open,
  onClose,
  me,
  planned = null,
  originalTeacherId,
  originalTeacherName = "",
  lessonDate,
  onSaved,
}) {
  const [teachers, setTeachers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [tempTeachers, setTempTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState("regular");
  const [showTempRegister, setShowTempRegister] = useState(false);
  const [tempForm, setTempForm] = useState({ ...EMPTY_TEMP_FORM });

  const [form, setForm] = useState({
    original_teacher_id: originalTeacherId || "",
    substitute_teacher_id: "",
    substitute_temp_teacher_id: "",
    institution_id: planned?.institutionId || "",
    time_slot: timeSlotFromPlanned(planned) || "",
    pay_type: planned?.payType || "정규",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tchs, insts, temps] = await Promise.all([
        fetchTeachers(),
        fetchInstitutions({ activeOnly: true }),
        fetchTemporaryEngagements(),
      ]);
      setTeachers(tchs.filter(t => t.role === "teacher"));
      setInstitutions(insts);
      setTempTeachers(temps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm({
      original_teacher_id: originalTeacherId || "",
      substitute_teacher_id: "",
      substitute_temp_teacher_id: "",
      institution_id: planned?.institutionId || "",
      time_slot: timeSlotFromPlanned(planned) || "",
      pay_type: planned?.payType || "정규",
      reason: "",
    });
    setSubTab("regular");
    setShowTempRegister(false);
    setTempForm({ ...EMPTY_TEMP_FORM });
    load();
  }, [open, originalTeacherId, planned, load]);

  const teachersById = useMemo(
    () => Object.fromEntries(teachers.map(t => [t.id, t])),
    [teachers],
  );

  const substituteCandidates = useMemo(
    () => teachers.filter(t => t.id !== form.original_teacher_id),
    [teachers, form.original_teacher_id],
  );

  const selectedTempTeacher = useMemo(
    () => tempTeachers.find(t => t.id === form.substitute_temp_teacher_id) || null,
    [tempTeachers, form.substitute_temp_teacher_id],
  );

  const handleRegisterTemp = async () => {
    if (!tempForm.name.trim()) {
      alert("임시 선생님 이름을 입력해 주세요.");
      return;
    }
    if (!form.institution_id) {
      alert("기관을 먼저 선택해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const created = await registerTemporaryTeacher({
        name: tempForm.name,
        institution_id: form.institution_id,
        pay_mode: tempForm.pay_mode,
        rate_amount: tempForm.rate_amount,
        work_hours: tempForm.work_hours || null,
        pay_type: form.pay_type,
        engagement_start_date: lessonDate,
        created_by: me?.id,
      });
      setTempTeachers(prev => [created, ...prev]);
      setForm(f => ({ ...f, substitute_temp_teacher_id: created.id }));
      setShowTempRegister(false);
      setTempForm({ ...EMPTY_TEMP_FORM });
    } catch (err) {
      alert("임시 선생님 등록 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.original_teacher_id) {
      alert("원래 선생님을 선택해 주세요.");
      return;
    }
    if (!form.institution_id || !form.time_slot || !lessonDate) {
      alert("날짜, 시간, 기관을 입력해 주세요.");
      return;
    }
    const substituteTeacherId = subTab === "regular" ? form.substitute_teacher_id : null;
    const substituteTempTeacherId = subTab === "temp" ? form.substitute_temp_teacher_id : null;
    if (!substituteTeacherId && !substituteTempTeacherId) {
      alert("대체 선생님을 선택해 주세요.");
      return;
    }
    if (substituteTeacherId === form.original_teacher_id) {
      alert("원래 선생님과 대체 선생님이 같을 수 없습니다.");
      return;
    }

    setSaving(true);
    try {
      await registerSubstituteLesson({
        me,
        planned: planned || {
          institutionId: form.institution_id,
          payType: form.pay_type,
          scheduledMinutes: 0,
          startTime: form.time_slot.split("-")[0]?.trim(),
          endTime: form.time_slot.split("-")[1]?.trim(),
          slot: { id: planned?.slot?.id || null },
        },
        originalTeacherId: form.original_teacher_id,
        substituteTeacherId,
        substituteTempTeacherId,
        substituteTempTeacher: selectedTempTeacher,
        lessonDate,
        reason: form.reason,
        teachersById,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert("대체수업 등록 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="sch-modal-overlay" onClick={onClose}>
      <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
        <h3>대체수업 등록</h3>
        <p className="sch-muted">
          {lessonDate}
          {originalTeacherName ? ` · ${originalTeacherName} 선생님` : ""}
        </p>

        {loading ? (
          <p className="sch-muted">불러오는 중...</p>
        ) : (
          <form className="sch-form" onSubmit={handleSubmit}>
            <label className="sch-field">
              <span>원래 선생님</span>
              <select
                value={form.original_teacher_id}
                onChange={e => setForm(f => ({ ...f, original_teacher_id: e.target.value }))}
                required
              >
                <option value="">선택</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <div className="sch-tabs">
              <button
                type="button"
                className={`sch-tab${subTab === "regular" ? " sch-tab--active" : ""}`}
                onClick={() => setSubTab("regular")}
              >
                기존 선생님
              </button>
              <button
                type="button"
                className={`sch-tab${subTab === "temp" ? " sch-tab--active" : ""}`}
                onClick={() => setSubTab("temp")}
              >
                임시 선생님
              </button>
            </div>

            {subTab === "regular" ? (
              <label className="sch-field">
                <span>대체 선생님</span>
                <select
                  value={form.substitute_teacher_id}
                  onChange={e => setForm(f => ({ ...f, substitute_teacher_id: e.target.value }))}
                >
                  <option value="">선택</option>
                  {substituteCandidates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="sch-field">
                  <span>임시 선생님</span>
                  <select
                    value={form.substitute_temp_teacher_id}
                    onChange={e => setForm(f => ({ ...f, substitute_temp_teacher_id: e.target.value }))}
                  >
                    <option value="">선택</option>
                    {tempTeachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.rate_amount ? ` (${Number(t.rate_amount).toLocaleString()}원)` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {!showTempRegister ? (
                  <button
                    type="button"
                    className="sch-btn sch-btn--ghost sch-btn--sm"
                    onClick={() => setShowTempRegister(true)}
                  >
                    + 새 임시 선생님 등록
                  </button>
                ) : (
                  <div className="sch-inline-form sch-inline-form--bordered">
                    <p className="sch-form-section-title">새 임시 선생님</p>
                    <label className="sch-field">
                      <span>이름</span>
                      <input
                        value={tempForm.name}
                        onChange={e => setTempForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </label>
                    <label className="sch-field">
                      <span>급여 방식</span>
                      <select
                        value={tempForm.pay_mode}
                        onChange={e => setTempForm(f => ({ ...f, pay_mode: e.target.value }))}
                      >
                        <option value="hourly">시급</option>
                        <option value="per_session">회당</option>
                        <option value="daily">일당</option>
                        <option value="fixed_total">총액</option>
                      </select>
                    </label>
                    <label className="sch-field">
                      <span>수업료 (원)</span>
                      <input
                        type="number"
                        min="0"
                        value={tempForm.rate_amount}
                        onChange={e => setTempForm(f => ({ ...f, rate_amount: e.target.value }))}
                      />
                    </label>
                    {tempForm.pay_mode === "hourly" ? (
                      <label className="sch-field">
                        <span>시간 (선택)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={tempForm.work_hours}
                          onChange={e => setTempForm(f => ({ ...f, work_hours: e.target.value }))}
                        />
                      </label>
                    ) : null}
                    <div className="sch-form-actions">
                      <button
                        type="button"
                        className="sch-btn sch-btn--ghost"
                        onClick={() => setShowTempRegister(false)}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="sch-btn sch-btn--primary"
                        disabled={saving}
                        onClick={handleRegisterTemp}
                      >
                        등록
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <label className="sch-field">
              <span>기관</span>
              <select
                value={form.institution_id}
                onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}
                required
                disabled={Boolean(planned?.institutionId)}
              >
                <option value="">선택</option>
                {institutions.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </label>

            <label className="sch-field">
              <span>시간 (예: 09:50-10:30)</span>
              <input
                value={form.time_slot}
                onChange={e => setForm(f => ({ ...f, time_slot: e.target.value }))}
                placeholder="09:50-10:30"
                required
                readOnly={Boolean(planned && timeSlotFromPlanned(planned))}
              />
            </label>

            <label className="sch-field">
              <span>수업 유형</span>
              <select
                value={form.pay_type}
                onChange={e => setForm(f => ({ ...f, pay_type: e.target.value }))}
              >
                {PAY_TYPES.map(pt => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </label>

            <label className="sch-field">
              <span>사유</span>
              <textarea
                rows={2}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="대체 사유 (선택)"
              />
            </label>

            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "등록 중..." : "등록"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
