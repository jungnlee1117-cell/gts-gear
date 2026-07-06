import { useCallback, useEffect, useMemo, useState } from "react";
import { formatWon } from "./constants.js";
import { fetchInstitutions, fetchPayRates } from "./api.js";
import { registerOneoffLesson, saveOneoffLesson } from "./oneoffLessonService.js";
import { oneoffLessonMinutes } from "./oneoffLessons.js";
import { listInstitutionsForOneoffLesson } from "./oneoffInstitutions.js";
import { pickRateForDate } from "./settlement.js";
import InstitutionSearchSelect from "./InstitutionSearchSelect.jsx";

const EMPTY_FORM = {
  start_time: "09:00",
  end_time: "10:00",
  institution_id: "",
  memo: "",
  link_payroll: false,
  pay_amount: "",
};

export default function OneoffLessonModal({
  open,
  onClose,
  me,
  teacherId,
  teacherName = "",
  lessonDate,
  editingLesson = null,
  onSaved,
}) {
  const [institutions, setInstitutions] = useState([]);
  const [payRates, setPayRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insts, rates] = await Promise.all([
        fetchInstitutions({ activeOnly: false }),
        fetchPayRates(),
      ]);
      setInstitutions(listInstitutionsForOneoffLesson(insts));
      setPayRates(rates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editingLesson) {
      setForm({
        start_time: String(editingLesson.start_time || "").slice(0, 5),
        end_time: String(editingLesson.end_time || "").slice(0, 5),
        institution_id: editingLesson.institution_id || "",
        memo: editingLesson.memo || "",
        link_payroll: Boolean(editingLesson.link_payroll),
        pay_amount: editingLesson.pay_amount != null ? String(editingLesson.pay_amount) : "",
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    load();
  }, [open, editingLesson, load]);

  const previewMinutes = oneoffLessonMinutes({
    start_time: form.start_time,
    end_time: form.end_time,
  });

  const selectedInstitution = useMemo(
    () => institutions.find(i => i.id === form.institution_id) ?? null,
    [institutions, form.institution_id],
  );

  const payTypeForRate = useMemo(() => {
    const name = String(selectedInstitution?.name || "");
    if (/센터보조/.test(name)) return "센터보조";
    if (/센터|엘리트|play by gts/i.test(name)) return "센터";
    return "정규";
  }, [selectedInstitution]);

  const ratePerMinute = useMemo(() => {
    if (!teacherId || !lessonDate) return 0;
    return Number(pickRateForDate(payRates, teacherId, payTypeForRate, lessonDate)) || 0;
  }, [payRates, teacherId, payTypeForRate, lessonDate]);

  const autoPayAmount = useMemo(() => {
    if (!form.link_payroll || previewMinutes <= 0 || ratePerMinute <= 0) return null;
    return Math.round(previewMinutes * ratePerMinute);
  }, [form.link_payroll, previewMinutes, ratePerMinute]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teacherId || !lessonDate) {
      alert("선생님과 날짜를 확인해 주세요.");
      return;
    }
    if (!form.institution_id) {
      alert("기관을 선택해 주세요.");
      return;
    }
    if (!form.start_time || !form.end_time) {
      alert("시간을 입력해 주세요.");
      return;
    }
    if (previewMinutes <= 0) {
      alert("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        me,
        teacherId,
        lessonDate,
        startTime: form.start_time,
        endTime: form.end_time,
        institutionId: form.institution_id,
        memo: form.memo,
        linkPayroll: form.link_payroll,
        payAmount: form.link_payroll && form.pay_amount !== "" ? form.pay_amount : null,
        payType: payTypeForRate,
      };
      if (editingLesson) {
        await saveOneoffLesson({ ...payload, lesson: editingLesson });
      } else {
        await registerOneoffLesson(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(`일회성 수업 ${editingLesson ? "수정" : "등록"} 실패: ` + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="sch-modal-overlay" onClick={onClose}>
      <div className="sch-modal sch-modal--wide sch-modal--oneoff" onClick={e => e.stopPropagation()}>
        <h3>{editingLesson ? "일회성 수업 수정" : "일회성 수업 등록"}</h3>
        <p className="sch-muted">
          {lessonDate}
          {teacherName ? ` · ${teacherName} 선생님` : ""}
        </p>

        {loading ? (
          <p className="sch-muted">불러오는 중...</p>
        ) : (
          <form className="sch-form" onSubmit={handleSubmit}>
            <label className="sch-field">
              <span>날짜</span>
              <input type="date" className="sch-input" value={lessonDate} readOnly />
            </label>

            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작</span>
                <input
                  type="time"
                  className="sch-input"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  required
                />
              </label>
              <label className="sch-field">
                <span>종료</span>
                <input
                  type="time"
                  className="sch-input"
                  value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  required
                />
              </label>
            </div>
            {previewMinutes > 0 ? (
              <p className="sch-muted sch-oneoff-duration-hint">{previewMinutes}분 수업</p>
            ) : null}

            <label className="sch-field">
              <span>기관</span>
              <InstitutionSearchSelect
                institutions={institutions}
                value={form.institution_id}
                onChange={institution_id => setForm(f => ({ ...f, institution_id }))}
                required
                placeholder="원·센터 이름 검색"
              />
            </label>

            <label className="sch-field">
              <span>메모 (선택)</span>
              <textarea
                rows={2}
                className="sch-input"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="특이사항"
              />
            </label>

            <label className="sch-field sch-field--checkbox sch-field--checkbox-dark">
              <input
                type="checkbox"
                checked={form.link_payroll}
                onChange={e => setForm(f => ({ ...f, link_payroll: e.target.checked }))}
              />
              <span>급여 반영</span>
            </label>

            {form.link_payroll ? (
              <>
                <label className="sch-field">
                  <span>수업료 (원) - 비워두면 자동 계산</span>
                  <input
                    type="number"
                    className="sch-input"
                    min="0"
                    step="1000"
                    value={form.pay_amount}
                    onChange={e => setForm(f => ({ ...f, pay_amount: e.target.value }))}
                    placeholder={autoPayAmount != null ? String(autoPayAmount) : "예: 50000"}
                  />
                  {form.pay_amount ? (
                    <span className="sch-muted">{formatWon(form.pay_amount)}</span>
                  ) : null}
                </label>
                {form.pay_amount === "" && autoPayAmount != null ? (
                  <p className="sch-oneoff-pay-hint">
                    자동 계산: {previewMinutes}분 ÷ 60 × 시간당 {(ratePerMinute * 60).toLocaleString("ko-KR")}원
                    {" "}= {formatWon(autoPayAmount)}
                  </p>
                ) : form.pay_amount === "" && previewMinutes > 0 && ratePerMinute <= 0 ? (
                  <p className="sch-muted sch-oneoff-pay-hint">
                    등록된 {payTypeForRate} 단가가 없어 자동 계산할 수 없습니다. 수업료를 직접 입력해 주세요.
                  </p>
                ) : null}
              </>
            ) : null}

            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "저장 중..." : editingLesson ? "수정" : "등록"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
