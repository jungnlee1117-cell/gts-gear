import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { changeInstitutionManager } from "./api.js";
import { filterClassTeacherAssignments } from "./assignmentRoles.js";
import { transferInstitutionTeacher } from "./transferInstitutionTeacher.js";
import { sendPushEvent } from "../pushNotifications.js";
import { scheduleSupabase } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 담당자 변경 / 수업 선생님 변경 탭 모달
 */
export default function InstitutionTeacherTransferModal({
  institution,
  assignments = [],
  weekly = [],
  teachers = [],
  teacherList = [],
  adminList = [],
  initialTab = "manager",
  onClose,
  onDone,
}) {
  const [tab, setTab] = useState(initialTab === "teacher" ? "teacher" : "manager");
  const [saving, setSaving] = useState(false);

  // ── 담당자 탭 ──
  const [managerId, setManagerId] = useState(institution?.manager_id || "");
  const [managerSearch, setManagerSearch] = useState("");

  useEffect(() => {
    setManagerId(institution?.manager_id || "");
  }, [institution?.manager_id]);

  const currentManager = useMemo(
    () => teachers.find(t => t.id === institution?.manager_id) || null,
    [teachers, institution?.manager_id],
  );

  const managerCandidates = useMemo(() => {
    let list = (adminList.length ? adminList : teachers.filter(t =>
      t.role === "admin" || t.role === "superadmin",
    )).filter(t => t.active !== false && !t.resigned_at);
    if (managerSearch.trim()) {
      const q = managerSearch.trim().toLowerCase();
      list = list.filter(t => String(t.name || "").toLowerCase().includes(q));
    }
    return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  }, [adminList, teachers, managerSearch]);

  const handleManagerSave = async (e) => {
    e.preventDefault();
    if (!managerId) return alert("담당 관리자를 선택해 주세요.");
    if (managerId === (institution?.manager_id || "")) {
      return alert("현재 담당자와 동일합니다.");
    }
    const next = teachers.find(t => t.id === managerId);
    if (!confirm(`${institution?.name || "기관"} 담당자를 ${next?.name || "선택한 관리자"}(으)로 변경할까요?`)) {
      return;
    }
    setSaving(true);
    try {
      const { before } = await changeInstitutionManager({
        institutionId: institution.id,
        managerId,
      });
      const name = institution.name || "기관";
      try {
        await sendPushEvent(scheduleSupabase, "institution_teacher_assigned", {
          teacher_id: managerId,
          body: `${name} 담당이 배정됐습니다`,
          institution_name: name,
        });
      } catch (_) { /* ignore */ }
      if (before?.manager_id) {
        try {
          await sendPushEvent(scheduleSupabase, "institution_teacher_changed", {
            teacher_id: before.manager_id,
            body: `${name} 담당이 변경됐습니다`,
            institution_name: name,
          });
        } catch (_) { /* ignore */ }
      }
      alert("담당자가 변경되었습니다.");
      onDone?.();
      onClose?.();
    } catch (err) {
      alert("변경 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  // ── 수업 선생님 탭 ──
  const classAssignments = useMemo(
    () => filterClassTeacherAssignments(assignments),
    [assignments],
  );

  const currentTeachers = useMemo(() => {
    const byId = new Map();
    for (const a of classAssignments) {
      if (!a?.teacher_id) continue;
      byId.set(a.teacher_id, {
        id: a.teacher_id,
        name: a.teachers?.name || teacherList.find(t => t.id === a.teacher_id)?.name || "—",
        pay_types: a.pay_types || ["정규", "방과후"],
      });
    }
    for (const slot of weekly) {
      if (!slot?.teacher_id || byId.has(slot.teacher_id)) continue;
      const t = teacherList.find(x => x.id === slot.teacher_id);
      byId.set(slot.teacher_id, {
        id: slot.teacher_id,
        name: t?.name || "—",
        pay_types: ["정규", "방과후"],
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [classAssignments, weekly, teacherList]);

  const [fromTeacherId, setFromTeacherId] = useState("");
  const [toTeacherId, setToTeacherId] = useState("");
  const [transferDate, setTransferDate] = useState(todayISO);
  const [transferWeekly, setTransferWeekly] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (currentTeachers.length >= 1 && !fromTeacherId) {
      setFromTeacherId(currentTeachers[0].id);
    }
  }, [currentTeachers, fromTeacherId]);

  const fromTeacher = currentTeachers.find(t => t.id === fromTeacherId) || null;

  const teacherCandidates = useMemo(() => {
    let list = teacherList.filter(t =>
      t.id !== fromTeacherId
      && t.active !== false
      && !t.resigned_at,
    );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => String(t.name || "").toLowerCase().includes(q));
    }
    return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  }, [teacherList, fromTeacherId, search]);

  const handleTeacherTransfer = async (e) => {
    e.preventDefault();
    if (!fromTeacherId) return alert("현재 수업 선생님을 선택해 주세요.");
    if (!toTeacherId) return alert("새 수업 선생님을 선택해 주세요.");
    if (!transferDate) return alert("이관 시작일을 입력해 주세요.");
    if (!transferWeekly) return alert("이관 항목을 하나 이상 선택해 주세요.");
    if (!confirm(`${institution?.name || "기관"} 수업 선생님을 변경할까요?\n이관 시작일: ${transferDate}`)) {
      return;
    }

    setSaving(true);
    try {
      const result = await transferInstitutionTeacher({
        institutionId: institution.id,
        institutionName: institution.name,
        fromTeacherId,
        toTeacherId,
        transferDate,
        transferWeeklySchedule: transferWeekly,
        fromPayTypes: fromTeacher?.pay_types,
      });
      alert(`수업 선생님 변경이 완료되었습니다.\n이관된 시간표 슬롯: ${result.weeklyTransferred}건`);
      onDone?.();
      onClose?.();
    } catch (err) {
      alert("변경 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-modal-overlay" onClick={() => !saving && onClose?.()}>
      <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="sch-modal-head">
          <h3>담당자 / 수업 선생님 변경</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose} disabled={saving}>
            <X size={18}/>
          </button>
        </div>

        <div className="sch-tabs" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`sch-tab${tab === "manager" ? " active" : ""}`}
            onClick={() => setTab("manager")}
          >
            담당자 변경
          </button>
          <button
            type="button"
            className={`sch-tab${tab === "teacher" ? " active" : ""}`}
            onClick={() => setTab("teacher")}
          >
            수업 선생님 변경
          </button>
        </div>

        {tab === "manager" ? (
          <form className="sch-form" onSubmit={handleManagerSave}>
            <div className="sch-field">
              <span>현재 담당자 (관리자)</span>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {currentManager?.name || "미지정"}
              </p>
              <p className="sch-muted" style={{ marginTop: 6 }}>
                담당자는 해당 기관을 관리하는 관리자입니다. 수업 시간표는 이관되지 않습니다.
              </p>
            </div>

            <label className="sch-field">
              <span>새 담당자 검색</span>
              <div className="sch-search-inline">
                <Search size={16}/>
                <input
                  className="sch-input"
                  placeholder="관리자 이름 검색"
                  value={managerSearch}
                  onChange={e => setManagerSearch(e.target.value)}
                />
              </div>
            </label>

            <label className="sch-field">
              <span>새 담당자 *</span>
              <select
                className="sch-select"
                value={managerId}
                onChange={e => setManagerId(e.target.value)}
                required
              >
                <option value="">선택하세요</option>
                {managerCandidates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose} disabled={saving}>
                취소
              </button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "처리 중..." : "담당자 변경"}
              </button>
            </div>
          </form>
        ) : (
          <form className="sch-form" onSubmit={handleTeacherTransfer}>
            <p className="sch-muted" style={{ marginTop: 0 }}>
              수업 선생님은 실제 수업을 진행하는 선생님입니다. 시간표는 수업 선생님 기준으로 이관됩니다.
              추가·제거만 하려면 상세의 &quot;수업 선생님&quot; 탭을 이용하세요.
            </p>

            <div className="sch-field">
              <span>현재 수업 선생님 *</span>
              {currentTeachers.length === 0 ? (
                <p className="sch-muted">등록된 수업 선생님이 없습니다. &quot;수업 선생님&quot; 탭에서 먼저 추가해 주세요.</p>
              ) : currentTeachers.length === 1 ? (
                <p style={{ margin: 0, fontWeight: 700 }}>{currentTeachers[0].name}</p>
              ) : (
                <select
                  className="sch-select"
                  value={fromTeacherId}
                  onChange={e => {
                    setFromTeacherId(e.target.value);
                    setToTeacherId("");
                  }}
                  required
                >
                  {currentTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            <label className="sch-field">
              <span>새 수업 선생님 검색</span>
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
              <span>새 수업 선생님 *</span>
              <select
                className="sch-select"
                value={toTeacherId}
                onChange={e => setToTeacherId(e.target.value)}
                required
                disabled={!fromTeacherId && currentTeachers.length > 0}
              >
                <option value="">선택하세요</option>
                {teacherCandidates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label className="sch-field">
              <span>이관 시작일 *</span>
              <input
                type="date"
                className="sch-input"
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
                required
              />
            </label>

            <div className="sch-field">
              <span>이관 항목</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={transferWeekly}
                  onChange={e => setTransferWeekly(e.target.checked)}
                />
                <span>수업 시간표</span>
              </label>
              <p className="sch-muted" style={{ marginTop: 8 }}>
                교구 순환·급여 단가·담당 관리자는 변경하지 않습니다.
              </p>
            </div>

            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose} disabled={saving}>
                취소
              </button>
              <button
                type="submit"
                className="sch-btn sch-btn--primary"
                disabled={saving || currentTeachers.length === 0}
              >
                {saving ? "처리 중..." : "수업 선생님 변경"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
