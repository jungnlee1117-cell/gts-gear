import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CLASS_TYPES, DAY_LABELS, fmtLocalDate } from "./constants.js";
import {
  deleteWeeklySlot,
  fetchAssignments,
  fetchInstitutions,
  fetchTeachers,
  fetchWeeklySchedule,
  saveAssignment,
  saveWeeklySlot,
  upsertInstitution,
} from "./api.js";
import InstitutionSearchSelect from "./InstitutionSearchSelect.jsx";
import {
  filterInstitutionsForManagerScope,
  isScheduleRegionalManager,
  isScheduleSuperAdmin,
} from "./managerScope.js";
import { isScheduleAdmin } from "./roles.js";

function formatTime(t) {
  return t ? String(t).slice(0, 5) : "";
}

function formatDateShort(d) {
  if (!d) return "—";
  const [, m, day] = String(d).slice(0, 10).split("-");
  return `${Number(m)}/${Number(day)}`;
}

function emptyPeriod(index = 0) {
  return {
    key: `p-${Date.now()}-${index}`,
    start_time: index === 0 ? "10:00" : "11:00",
    end_time: index === 0 ? "10:30" : "12:00",
  };
}

const EMPTY_CREATE = {
  teacher_id: "",
  day_of_week: "1",
  effective_from: "",
  effective_to: "",
  institution_id: "",
  class_type: "정규",
  periods: [emptyPeriod(0)],
};

function emptyEdit(slot) {
  return {
    id: slot.id,
    teacher_id: slot.teacher_id || "",
    day_of_week: String(slot.day_of_week ?? 1),
    effective_from: slot.effective_from ? String(slot.effective_from).slice(0, 10) : "",
    effective_to: slot.effective_to ? String(slot.effective_to).slice(0, 10) : "",
    institution_id: slot.institution_id || "",
    class_type: slot.class_type || "정규",
    start_time: formatTime(slot.start_time),
    end_time: formatTime(slot.end_time),
  };
}

function periodLabel(classType, index) {
  if (classType === "방과후") return "방과후";
  return `${index + 1}교시`;
}

export default function RegularClassesManagePanel({ me }) {
  const admin = isScheduleAdmin(me);
  const superAdmin = isScheduleSuperAdmin(me);
  const regional = isScheduleRegionalManager(me);
  const canEdit = admin;

  const [teachers, setTeachers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [slots, setSlots] = useState([]);
  const [managedTeacherIds, setManagedTeacherIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingInst, setCreatingInst] = useState(false);

  const [teacherFilter, setTeacherFilter] = useState(() => (admin ? "" : me?.id || ""));
  const [dayFilter, setDayFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(() => ({
    ...EMPTY_CREATE,
    teacher_id: admin ? "" : (me?.id || ""),
    effective_from: fmtLocalDate(new Date()),
  }));
  const [editForm, setEditForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allTeachers, allInst, allSlots, assignments] = await Promise.all([
        fetchTeachers(),
        fetchInstitutions({
          activeOnly: false,
          teacherScope: !admin,
        }),
        admin
          ? fetchWeeklySchedule(null, null)
          : fetchWeeklySchedule(null, me.id),
        admin ? fetchAssignments(null, { activeOnly: true }) : Promise.resolve([]),
      ]);

      const scopedInst = admin
        ? filterInstitutionsForManagerScope(allInst, me)
        : allInst;
      setInstitutions(scopedInst);

      const roleTeachers = allTeachers.filter(t => t.role === "teacher");
      let allowedTeachers = roleTeachers;
      let allowedIds = new Set(roleTeachers.map(t => t.id));

      if (regional) {
        const instIds = new Set(scopedInst.map(i => i.id));
        allowedIds = new Set(
          (assignments || [])
            .filter(a => instIds.has(a.institution_id))
            .map(a => a.teacher_id),
        );
        // 담당 원에 이미 등록된 슬롯 강사도 포함
        for (const s of allSlots || []) {
          if (s.teacher_id && instIds.has(s.institution_id)) allowedIds.add(s.teacher_id);
        }
        allowedTeachers = roleTeachers.filter(t => allowedIds.has(t.id));
      } else if (!admin) {
        allowedTeachers = roleTeachers.filter(t => t.id === me.id);
        allowedIds = new Set([me.id]);
      }

      setTeachers(allowedTeachers);
      setManagedTeacherIds(allowedIds);

      const scopedSlots = (allSlots || []).filter(s => {
        if (!admin) return s.teacher_id === me.id;
        if (superAdmin) return true;
        if (!s.teacher_id) return scopedInst.some(i => i.id === s.institution_id);
        return allowedIds.has(s.teacher_id);
      });
      setSlots(scopedSlots);
    } catch (err) {
      console.error(err);
      alert("불러오기 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setLoading(false);
    }
  }, [admin, me, regional, superAdmin]);

  useEffect(() => { load(); }, [load]);

  const teacherMap = useMemo(() => {
    const m = new Map();
    for (const t of teachers) m.set(t.id, t.name);
    return m;
  }, [teachers]);

  const institutionMap = useMemo(() => {
    const m = new Map();
    for (const i of institutions) m.set(i.id, i);
    return m;
  }, [institutions]);

  const filteredSlots = useMemo(() => {
    return slots
      .filter(s => {
        if (teacherFilter && s.teacher_id !== teacherFilter) return false;
        if (dayFilter !== "all" && String(s.day_of_week) !== dayFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dow = a.day_of_week - b.day_of_week;
        if (dow !== 0) return dow;
        return formatTime(a.start_time).localeCompare(formatTime(b.start_time));
      });
  }, [slots, teacherFilter, dayFilter]);

  const openCreate = () => {
    setCreateForm({
      ...EMPTY_CREATE,
      teacher_id: teacherFilter || (admin ? "" : me.id),
      effective_from: fmtLocalDate(new Date()),
      periods: [emptyPeriod(0)],
    });
    setShowCreate(true);
  };

  const handleCreateInstitution = async (name) => {
    setCreatingInst(true);
    try {
      const created = await upsertInstitution({
        name: name.trim(),
        is_active: true,
        manager_id: regional ? me.id : (me.id || null),
      });
      setInstitutions(prev => {
        if (prev.some(i => i.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      });
      return created;
    } catch (err) {
      alert("기관 추가 실패: " + err.message);
      return null;
    } finally {
      setCreatingInst(false);
    }
  };

  const handleDeactivateInstitution = async (institutionId) => {
    const inst = institutionMap.get(institutionId);
    if (!inst) return;
    if (!confirm(`「${inst.name}」을(를) 비활성(나간 기관) 처리할까요?\n목록에서 숨겨지며 삭제되지 않습니다.`)) return;
    setSaving(true);
    try {
      await upsertInstitution({ ...inst, is_active: false });
      setInstitutions(prev => prev.map(i => (i.id === institutionId ? { ...i, is_active: false } : i)));
      alert("비활성 처리되었습니다.");
    } catch (err) {
      alert("비활성 처리 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const canEditTeacher = (teacherId) => {
    if (!canEdit) return false;
    if (superAdmin) return true;
    if (!teacherId) return true;
    return managedTeacherIds.has(teacherId);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const {
      teacher_id,
      day_of_week,
      effective_from,
      effective_to,
      institution_id,
      class_type,
      periods,
    } = createForm;
    if (!teacher_id) return alert("선생님을 선택해주세요.");
    if (!canEditTeacher(teacher_id)) return alert("담당 선생님만 등록할 수 있습니다.");
    if (!institution_id) return alert("기관을 선택하거나 새로 추가해주세요.");
    if (!effective_from) return alert("시작 날짜를 입력해주세요.");
    if (effective_to && effective_to < effective_from) {
      return alert("종료 날짜는 시작 날짜 이후여야 합니다.");
    }
    if (!periods.length) return alert("수업 시간을 1개 이상 입력해주세요.");
    for (const p of periods) {
      if (!p.start_time || !p.end_time) return alert("시작·종료 시간을 모두 입력해주세요.");
      if (p.start_time >= p.end_time) return alert("종료 시간은 시작 시간보다 늦어야 합니다.");
    }

    setSaving(true);
    try {
      try {
        await saveAssignment({
          institution_id,
          teacher_id,
          pay_types: [class_type === "방과후" ? "방과후" : "정규"],
        });
      } catch (assignErr) {
        console.warn("assignment save skipped:", assignErr);
      }

      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        await saveWeeklySlot({
          institution_id,
          teacher_id,
          day_of_week: Number(day_of_week),
          class_type,
          start_time: p.start_time,
          end_time: p.end_time,
          label: periodLabel(class_type, i),
          sort_order: i,
          effective_from,
          effective_to: effective_to || null,
        });
      }
      setShowCreate(false);
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm || !canEdit) return;
    if (!canEditTeacher(editForm.teacher_id)) return alert("담당 선생님만 수정할 수 있습니다.");
    if (!editForm.institution_id) return alert("기관을 선택해주세요.");
    if (!editForm.start_time || !editForm.end_time) return alert("시간을 입력해주세요.");
    if (editForm.start_time >= editForm.end_time) {
      return alert("종료 시간은 시작 시간보다 늦어야 합니다.");
    }
    if (editForm.effective_from && editForm.effective_to
      && editForm.effective_to < editForm.effective_from) {
      return alert("종료 날짜는 시작 날짜 이후여야 합니다.");
    }

    setSaving(true);
    try {
      await saveWeeklySlot({
        id: editForm.id,
        institution_id: editForm.institution_id,
        teacher_id: editForm.teacher_id || null,
        day_of_week: Number(editForm.day_of_week),
        class_type: editForm.class_type,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        effective_from: editForm.effective_from || null,
        effective_to: editForm.effective_to || null,
      });
      setEditForm(null);
      await load();
    } catch (err) {
      alert("수정 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slot) => {
    if (!canEdit) return;
    if (!canEditTeacher(slot.teacher_id)) return alert("담당 선생님만 삭제할 수 있습니다.");
    const instName = institutionMap.get(slot.institution_id)?.name || slot.institutions?.name || "기관";
    const label = `${DAY_LABELS[slot.day_of_week]} ${formatTime(slot.start_time)}–${formatTime(slot.end_time)} · ${instName}`;
    if (!confirm(`이 수업을 삭제할까요?\n\n${label}`)) return;
    setSaving(true);
    try {
      await deleteWeeklySlot(slot.id);
      await load();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-regular-classes">
      <div className="sch-regular-classes-toolbar">
        <label className="sch-field sch-regular-classes-filter">
          <span>선생님</span>
          <select
            className="sch-select"
            value={teacherFilter}
            disabled={!admin}
            onChange={e => setTeacherFilter(e.target.value)}
          >
            {admin ? <option value="">전체</option> : null}
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="sch-field sch-regular-classes-filter">
          <span>요일</span>
          <select
            className="sch-select"
            value={dayFilter}
            onChange={e => setDayFilter(e.target.value)}
          >
            <option value="all">전체</option>
            {DAY_LABELS.map((d, i) => (
              <option key={d} value={String(i)}>{d}</option>
            ))}
          </select>
        </label>
        {canEdit ? (
          <button type="button" className="sch-btn sch-btn--primary" onClick={openCreate}>
            <Plus size={14}/> 정규 수업 등록
          </button>
        ) : null}
      </div>

      <p className="sch-muted sch-regular-classes-hint">
        {canEdit
          ? "등록된 정규·방과후 주간 수업입니다. 수업을 클릭하면 수정할 수 있습니다."
          : "담당 기관의 정규·방과후 주간 수업을 조회합니다."}
      </p>

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : filteredSlots.length === 0 ? (
        <p className="sch-muted">등록된 수업이 없습니다.</p>
      ) : (
        <ul className="sch-regular-classes-list">
          {filteredSlots.map(slot => {
            const inst = institutionMap.get(slot.institution_id);
            const instName = inst?.name || slot.institutions?.name || "—";
            const editable = canEditTeacher(slot.teacher_id);
            return (
              <li key={slot.id} className="sch-regular-classes-item">
                <button
                  type="button"
                  className="sch-regular-classes-main"
                  disabled={!editable}
                  onClick={() => editable && setEditForm(emptyEdit(slot))}
                >
                  <span className="sch-regular-classes-dow">{DAY_LABELS[slot.day_of_week]}</span>
                  <span className="sch-regular-classes-time">
                    {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                  </span>
                  <span className="sch-regular-classes-type">{slot.class_type}</span>
                  <span className="sch-regular-classes-inst">{instName}</span>
                  <span className="sch-regular-classes-teacher">
                    {teacherMap.get(slot.teacher_id) || "강사 미지정"}
                  </span>
                  <span className="sch-regular-classes-range">
                    {formatDateShort(slot.effective_from)}
                    {" ~ "}
                    {slot.effective_to ? formatDateShort(slot.effective_to) : "계속"}
                  </span>
                </button>
                {editable ? (
                  <div className="sch-regular-classes-actions">
                    <button
                      type="button"
                      className="sch-btn sch-btn--ghost sch-btn--sm"
                      disabled={saving}
                      onClick={() => setEditForm(emptyEdit(slot))}
                    >
                      <Pencil size={13}/> 수정
                    </button>
                    <button
                      type="button"
                      className="sch-btn sch-btn--ghost sch-btn--sm sch-regular-classes-delete"
                      disabled={saving}
                      onClick={() => handleDelete(slot)}
                    >
                      <Trash2 size={13}/> 삭제
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && canEdit ? (
        <div className="sch-modal-overlay" onClick={() => setShowCreate(false)}>
          <form
            className="sch-modal sch-form sch-modal--wide"
            onClick={e => e.stopPropagation()}
            onSubmit={handleCreateSubmit}
          >
            <h3>정규 수업 등록</h3>
            <label className="sch-field">
              <span>선생님</span>
              <select
                className="sch-select"
                required
                value={createForm.teacher_id}
                onChange={e => setCreateForm(f => ({ ...f, teacher_id: e.target.value }))}
              >
                <option value="">선택</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="sch-field">
              <span>요일</span>
              <select
                className="sch-select"
                value={createForm.day_of_week}
                onChange={e => setCreateForm(f => ({ ...f, day_of_week: e.target.value }))}
              >
                {DAY_LABELS.map((d, i) => (
                  <option key={d} value={String(i)}>{d}</option>
                ))}
              </select>
            </label>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작 날짜</span>
                <input
                  type="date"
                  className="sch-input"
                  required
                  value={createForm.effective_from}
                  onChange={e => setCreateForm(f => ({ ...f, effective_from: e.target.value }))}
                />
              </label>
              <label className="sch-field">
                <span>종료 날짜 (선택)</span>
                <input
                  type="date"
                  className="sch-input"
                  value={createForm.effective_to}
                  onChange={e => setCreateForm(f => ({ ...f, effective_to: e.target.value }))}
                />
              </label>
            </div>

            <div className="sch-regular-classes-periods">
              <div className="sch-section-header-row">
                <span className="sch-field-label">수업 시간</span>
                <button
                  type="button"
                  className="sch-btn sch-btn--ghost sch-btn--sm"
                  onClick={() => setCreateForm(f => ({
                    ...f,
                    periods: [...f.periods, emptyPeriod(f.periods.length)],
                  }))}
                >
                  <Plus size={13}/> 교시 추가
                </button>
              </div>
              {createForm.periods.map((p, idx) => (
                <div key={p.key} className="sch-regular-classes-period-row">
                  <span className="sch-regular-classes-period-label">
                    {periodLabel(createForm.class_type, idx)}
                  </span>
                  <input
                    type="time"
                    className="sch-input"
                    required
                    value={p.start_time}
                    onChange={e => setCreateForm(f => ({
                      ...f,
                      periods: f.periods.map((row, i) => (
                        i === idx ? { ...row, start_time: e.target.value } : row
                      )),
                    }))}
                  />
                  <span className="sch-muted">~</span>
                  <input
                    type="time"
                    className="sch-input"
                    required
                    value={p.end_time}
                    onChange={e => setCreateForm(f => ({
                      ...f,
                      periods: f.periods.map((row, i) => (
                        i === idx ? { ...row, end_time: e.target.value } : row
                      )),
                    }))}
                  />
                  {createForm.periods.length > 1 ? (
                    <button
                      type="button"
                      className="sch-btn sch-btn--ghost sch-btn--sm"
                      onClick={() => setCreateForm(f => ({
                        ...f,
                        periods: f.periods.filter((_, i) => i !== idx),
                      }))}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <label className="sch-field">
              <span>기관</span>
              <InstitutionSearchSelect
                institutions={institutions}
                value={createForm.institution_id}
                onChange={id => setCreateForm(f => ({ ...f, institution_id: id }))}
                required
                allowCreate
                creating={creatingInst}
                onCreateInstitution={handleCreateInstitution}
                placeholder="기관명 검색 또는 새 기관 입력"
              />
            </label>
            {createForm.institution_id ? (
              <button
                type="button"
                className="sch-btn sch-btn--ghost sch-btn--sm"
                disabled={saving || institutionMap.get(createForm.institution_id)?.is_active === false}
                onClick={() => handleDeactivateInstitution(createForm.institution_id)}
              >
                선택 기관 비활성(나간 기관) 처리
              </button>
            ) : null}

            <label className="sch-field">
              <span>수업 유형</span>
              <div className="sch-chip-row">
                {CLASS_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`sch-chip${createForm.class_type === t ? " active" : ""}`}
                    onClick={() => setCreateForm(f => ({ ...f, class_type: t }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </label>

            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setShowCreate(false)}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving || creatingInst}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editForm && canEdit ? (
        <div className="sch-modal-overlay" onClick={() => setEditForm(null)}>
          <form
            className="sch-modal sch-form"
            onClick={e => e.stopPropagation()}
            onSubmit={handleEditSubmit}
          >
            <h3>수업 수정</h3>
            <label className="sch-field">
              <span>요일</span>
              <select
                className="sch-select"
                value={editForm.day_of_week}
                onChange={e => setEditForm(f => ({ ...f, day_of_week: e.target.value }))}
              >
                {DAY_LABELS.map((d, i) => (
                  <option key={d} value={String(i)}>{d}</option>
                ))}
              </select>
            </label>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작</span>
                <input
                  type="time"
                  className="sch-input"
                  required
                  value={editForm.start_time}
                  onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))}
                />
              </label>
              <label className="sch-field">
                <span>종료</span>
                <input
                  type="time"
                  className="sch-input"
                  required
                  value={editForm.end_time}
                  onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </label>
            </div>
            <label className="sch-field">
              <span>기관</span>
              <InstitutionSearchSelect
                institutions={institutions}
                value={editForm.institution_id}
                onChange={id => setEditForm(f => ({ ...f, institution_id: id }))}
                required
                allowCreate
                creating={creatingInst}
                onCreateInstitution={handleCreateInstitution}
              />
            </label>
            <label className="sch-field">
              <span>수업 유형</span>
              <div className="sch-chip-row">
                {CLASS_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`sch-chip${editForm.class_type === t ? " active" : ""}`}
                    onClick={() => setEditForm(f => ({ ...f, class_type: t }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </label>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작 날짜</span>
                <input
                  type="date"
                  className="sch-input"
                  value={editForm.effective_from}
                  onChange={e => setEditForm(f => ({ ...f, effective_from: e.target.value }))}
                />
              </label>
              <label className="sch-field">
                <span>종료 날짜</span>
                <input
                  type="date"
                  className="sch-input"
                  value={editForm.effective_to}
                  onChange={e => setEditForm(f => ({ ...f, effective_to: e.target.value }))}
                />
              </label>
            </div>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setEditForm(null)}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
