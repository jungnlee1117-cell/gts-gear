import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PAY_TYPES } from "./constants.js";
import { saveAssignment } from "./api.js";

/**
 * 수업 선생님의 수업 유형(pay_types)만 수정
 */
export default function InstitutionTeacherPayTypesModal({
  assignment,
  onClose,
  onSaved,
}) {
  const [payTypes, setPayTypes] = useState(() => [...(assignment?.pay_types || [])]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPayTypes([...(assignment?.pay_types || [])]);
  }, [assignment]);

  const toggleType = (type) => {
    setPayTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!payTypes.length) return alert("수업 유형을 하나 이상 선택해 주세요.");
    setSaving(true);
    try {
      await saveAssignment({
        institution_id: assignment.institution_id,
        teacher_id: assignment.teacher_id,
        pay_types: PAY_TYPES.filter((t) => payTypes.includes(t)),
        role: "teacher",
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert("저장 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  const teacherName = assignment?.teachers?.name || "선생님";

  return (
    <div className="sch-modal-overlay" onClick={() => !saving && onClose?.()}>
      <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="sch-modal-head">
          <h3>수업 유형 수정</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose} disabled={saving}>
            <X size={18}/>
          </button>
        </div>
        <form className="sch-form" onSubmit={handleSave}>
          <div className="sch-field">
            <span>수업 선생님</span>
            <p style={{ margin: 0, fontWeight: 800 }}>{teacherName} 선생님</p>
          </div>
          <div className="sch-field">
            <span>수업 유형 * (복수 선택)</span>
            <div className="sch-chip-row">
              {PAY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`sch-chip${payTypes.includes(type) ? " active" : ""}`}
                  onClick={() => toggleType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <p className="sch-muted" style={{ marginTop: 8 }}>
              시간표의 요일·시간은 바뀌지 않습니다. 이 선생님에게 배정된 수업 유형만 수정됩니다.
            </p>
          </div>
          <div className="sch-form-actions">
            <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
