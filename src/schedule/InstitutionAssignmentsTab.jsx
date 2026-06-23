import { useMemo, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { PAY_TYPES } from "./constants.js";
import { deactivateAssignment, saveAssignment } from "./api.js";

function formatAssignDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export default function InstitutionAssignmentsTab({
  institutionId,
  assignments,
  teacherList,
  onRefresh,
}) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    teacher_id: "",
    pay_types: ["정규"],
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const assignedIds = useMemo(
    () => new Set(assignments.map(a => a.teacher_id)),
    [assignments],
  );

  const availableTeachers = useMemo(() => {
    let list = teacherList.filter(t => !assignedIds.has(t.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [teacherList, assignedIds, search]);

  const togglePayType = (type) => {
    setForm(f => ({
      ...f,
      pay_types: f.pay_types.includes(type)
        ? f.pay_types.filter(t => t !== type)
        : [...f.pay_types, type],
    }));
  };

  const openModal = () => {
    setForm({ teacher_id: "", pay_types: ["정규"] });
    setSearch("");
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.teacher_id) return alert("강사를 선택해주세요.");
    if (!form.pay_types.length) return alert("수업유형을 하나 이상 선택해주세요.");
    setSaving(true);
    try {
      await saveAssignment({
        institution_id: institutionId,
        teacher_id: form.teacher_id,
        pay_types: form.pay_types,
      });
      setShowModal(false);
      await onRefresh();
    } catch (err) {
      alert("배정 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await deactivateAssignment(confirmDelete.id);
      setConfirmDelete(null);
      await onRefresh();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sch-toolbar">
        <button type="button" className="sch-btn sch-btn--primary" onClick={openModal}>
          <Plus size={16}/> 강사 배정
        </button>
      </div>

      <div className="sch-table-wrap">
        <table className="sch-table">
          <thead>
            <tr>
              <th>강사</th>
              <th>수업유형</th>
              <th>배정일</th>
              <th/>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="sch-muted">배정된 강사가 없습니다.</td>
              </tr>
            ) : assignments.map(a => (
              <tr key={a.id}>
                <td>{a.teachers?.name || "—"}</td>
                <td>
                  <div className="sch-chip-row">
                    {(a.pay_types || []).map(t => (
                      <span key={t} className="sch-chip active">{t}</span>
                    ))}
                  </div>
                </td>
                <td>{formatAssignDate(a.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="sch-icon-btn"
                    aria-label="배정 삭제"
                    onClick={() => setConfirmDelete(a)}
                  >
                    <Trash2 size={16}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="sch-modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>강사 배정</h3>
              <button type="button" className="sch-icon-btn" onClick={() => setShowModal(false)}>
                <X size={18}/>
              </button>
            </div>
            <form className="sch-form" onSubmit={handleSave}>
              <label className="sch-field">
                <span>강사 검색</span>
                <div className="sch-search-inline">
                  <Search size={16}/>
                  <input
                    className="sch-input"
                    placeholder="이름으로 검색"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </label>
              <label className="sch-field">
                <span>강사 선택 *</span>
                <select
                  className="sch-select"
                  value={form.teacher_id}
                  onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
                  required
                >
                  <option value="">선택하세요</option>
                  {availableTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <div className="sch-field">
                <span>수업유형 * (복수 선택)</span>
                <div className="sch-chip-row">
                  {PAY_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`sch-chip${form.pay_types.includes(t) ? " active" : ""}`}
                      onClick={() => togglePayType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sch-form-actions">
                <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setShowModal(false)}>
                  취소
                </button>
                <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="sch-modal-overlay" onClick={() => !saving && setConfirmDelete(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <h3>배정 삭제</h3>
            <p className="sch-muted">
              <strong>{confirmDelete.teachers?.name}</strong> 강사의 이 원 배정을 삭제할까요?
              <br/>
              단가 계산·급여 집계에서 이 원 배정 기준 참고가 제외됩니다. 이미 입력된 수업시간 기록은 유지됩니다.
            </p>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setConfirmDelete(null)}>
                취소
              </button>
              <button type="button" className="sch-btn sch-btn--primary" onClick={handleDeactivate} disabled={saving}>
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
