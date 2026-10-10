import { useMemo, useState } from "react";
import { Pencil, Plus, Repeat2, Search, Trash2, X } from "lucide-react";
import { PAY_TYPES, fmtLocalDate } from "./constants.js";
import { deactivateAssignment, saveAssignment } from "./api.js";
import { filterClassTeacherAssignments } from "./assignmentRoles.js";
import InstitutionTeacherPayTypesModal from "./InstitutionTeacherPayTypesModal.jsx";
import InstitutionTeacherSlotTransferModal from "./InstitutionTeacherSlotTransferModal.jsx";
import WeeklySlotDayList from "./WeeklySlotDayList.jsx";
import WeeklySlotHistoryModal from "./WeeklySlotHistoryModal.jsx";
import { openTeacherSlots } from "./weeklySlotVersion.js";

function formatAssignDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/** 수업 선생님 추가/제거 (role=teacher) */
export default function InstitutionAssignmentsTab({
  institutionId,
  institution,
  assignments,
  weekly = [],
  teachers = [],
  teacherList = [],
  onRefresh,
  canEdit = true,
  changedBy = null,
}) {
  const classAssignments = useMemo(
    () => filterClassTeacherAssignments(assignments),
    [assignments],
  );

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    teacher_id: "",
    pay_types: ["정규"],
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editAssignment, setEditAssignment] = useState(null);
  const [transferAssignment, setTransferAssignment] = useState(null);
  const [historySlot, setHistorySlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const today = fmtLocalDate(new Date());

  const teacherName = (teacherId) => (
    teachers.find((teacher) => teacher.id === teacherId)?.name
    || teacherList.find((teacher) => teacher.id === teacherId)?.name
    || classAssignments.find((row) => row.teacher_id === teacherId)?.teachers?.name
    || "선생님"
  );

  const assignedIds = useMemo(
    () => new Set(classAssignments.map(a => a.teacher_id)),
    [classAssignments],
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
    if (!form.teacher_id) return alert("선생님을 선택해주세요.");
    if (!form.pay_types.length) return alert("수업유형을 하나 이상 선택해주세요.");
    setSaving(true);
    try {
      await saveAssignment({
        institution_id: institutionId,
        teacher_id: form.teacher_id,
        pay_types: form.pay_types,
        role: "teacher",
      });
      setShowModal(false);
      await onRefresh();
    } catch (err) {
      alert("추가 실패: " + (err.message || "알 수 없는 오류"));
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
      alert("제거 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="sch-muted" style={{ marginTop: 0 }}>
        실제 수업을 진행하는 선생님입니다. 담당 관리자와는 별개입니다.
        교체는 선택한 시간표 수업만 넘기고, 적용일 기준으로 기존 수업은 이력에 남습니다.
      </p>
      {canEdit ? (
        <div className="sch-toolbar">
          <button type="button" className="sch-btn sch-btn--primary" onClick={openModal}>
            <Plus size={16}/> 수업 선생님 추가
          </button>
        </div>
      ) : null}

      {classAssignments.length === 0 ? (
        <p className="sch-muted">등록된 수업 선생님이 없습니다.</p>
      ) : (
        <div className="sch-teacher-roster">
          {classAssignments.map((a) => {
            const slots = openTeacherSlots(weekly, {
              teacherId: a.teacher_id,
              institutionId,
              today,
            });
            return (
              <section key={a.id} className="sch-teacher-roster-card">
                <header className="sch-teacher-roster-head">
                  <strong>{a.teachers?.name || "—"}</strong>
                  <div className="sch-chip-row">
                    {(a.pay_types || []).map((type) => (
                      <span key={type} className="sch-chip active">{type}</span>
                    ))}
                  </div>
                  <span className="sch-muted">배정일 {formatAssignDate(a.created_at)}</span>
                  {canEdit ? (
                    <div className="sch-table-actions">
                      <button
                        type="button"
                        className="sch-icon-btn"
                        title="수업 유형 수정"
                        aria-label="수업 유형 수정"
                        onClick={() => setEditAssignment(a)}
                      >
                        <Pencil size={16}/>
                      </button>
                      <button
                        type="button"
                        className="sch-icon-btn"
                        title="선택한 수업만 교체"
                        aria-label={`${a.teachers?.name || "선생님"} 교체`}
                        onClick={() => setTransferAssignment(a)}
                      >
                        <Repeat2 size={16}/>
                      </button>
                      <button
                        type="button"
                        className="sch-icon-btn"
                        aria-label="수업 선생님 제거"
                        onClick={() => setConfirmDelete(a)}
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ) : null}
                </header>
                <div className="sch-regular-classes sch-regular-classes--no-inst sch-teacher-roster-slots">
                  <WeeklySlotDayList
                    slots={slots}
                    teacherName={teacherName}
                    onHistory={setHistorySlot}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showModal ? (
        <div className="sch-modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>수업 선생님 추가</h3>
              <button type="button" className="sch-icon-btn" onClick={() => setShowModal(false)}>
                <X size={18}/>
              </button>
            </div>
            <form className="sch-form" onSubmit={handleSave}>
              <label className="sch-field">
                <span>선생님 검색</span>
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
                <span>선생님 선택 *</span>
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
                  {saving ? "저장 중..." : "추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {transferAssignment ? (
        <InstitutionTeacherSlotTransferModal
          institution={institution}
          fromAssignment={transferAssignment}
          weekly={weekly}
          teachers={teachers}
          teacherList={teacherList}
          changedBy={changedBy}
          onClose={() => setTransferAssignment(null)}
          onDone={onRefresh}
        />
      ) : null}

      {historySlot ? (
        <WeeklySlotHistoryModal
          slot={historySlot}
          slots={weekly}
          institutionName={institution?.name}
          teacherName={teacherName}
          onClose={() => setHistorySlot(null)}
        />
      ) : null}

      {editAssignment ? (
        <InstitutionTeacherPayTypesModal
          assignment={editAssignment}
          onClose={() => setEditAssignment(null)}
          onSaved={onRefresh}
        />
      ) : null}

      {confirmDelete ? (
        <div className="sch-modal-overlay" onClick={() => !saving && setConfirmDelete(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <h3>수업 선생님 제거</h3>
            <p className="sch-muted">
              <strong>{confirmDelete.teachers?.name}</strong> 선생님을 이 원의 수업 선생님에서 제거할까요?
              <br/>
              이미 입력된 수업시간 기록은 유지됩니다.
            </p>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setConfirmDelete(null)}>
                취소
              </button>
              <button type="button" className="sch-btn sch-btn--primary" onClick={handleDeactivate} disabled={saving}>
                제거
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
