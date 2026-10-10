import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { changeInstitutionManager, scheduleSupabase } from "./api.js";
import { sendPushEvent } from "../pushNotifications.js";
import { isTeacherVisibleInYearMonth } from "./teacherEmployment.js";
import { yearMonthKey } from "./constants.js";
import {
  formatInstitutionManagerLabel,
  HQ_MANAGER_LABEL,
  isHeadquartersManager,
  regionalManagerOptions,
} from "./managerScope.js";

/** 기관 담당 관리자 변경. 수업 시간표는 옮기지 않는다. */
export default function InstitutionTeacherTransferModal({
  institution,
  teachers = [],
  adminList = [],
  onClose,
  onDone,
}) {
  const [saving, setSaving] = useState(false);

  // ── 담당자 탭 ──
  const currentManager = useMemo(
    () => teachers.find(t => t.id === institution?.manager_id) || null,
    [teachers, institution?.manager_id],
  );
  const currentIsHq = isHeadquartersManager(currentManager);

  const [managerId, setManagerId] = useState(
    () => (isHeadquartersManager(
      teachers.find(t => t.id === institution?.manager_id) || null,
    ) ? "" : (institution?.manager_id || "")),
  );
  const [managerSearch, setManagerSearch] = useState("");

  useEffect(() => {
    const current = teachers.find(t => t.id === institution?.manager_id) || null;
    setManagerId(isHeadquartersManager(current) ? "" : (institution?.manager_id || ""));
  }, [institution?.manager_id, teachers]);

  const managerCandidates = useMemo(() => {
    let list = regionalManagerOptions(
      (adminList.length ? adminList : teachers.filter(t =>
        t.role === "admin" || t.role === "superadmin",
      )).filter(t => isTeacherVisibleInYearMonth(t, yearMonthKey())),
    );
    if (managerSearch.trim()) {
      const q = managerSearch.trim().toLowerCase();
      list = list.filter(t => String(t.name || "").toLowerCase().includes(q));
    }
    return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  }, [adminList, teachers, managerSearch]);

  const showHqOption = !managerSearch.trim()
    || HQ_MANAGER_LABEL.toLowerCase().includes(managerSearch.trim().toLowerCase());

  const handleManagerSave = async (e) => {
    e.preventDefault();
    const currentId = currentIsHq ? "" : (institution?.manager_id || "");
    if (managerId === currentId) {
      return alert("현재 담당자와 동일합니다.");
    }
    const nextName = managerId
      ? (teachers.find(t => t.id === managerId)?.name || "선택한 관리자")
      : HQ_MANAGER_LABEL;
    if (!confirm(`${institution?.name || "기관"} 담당자를 ${nextName}(으)로 변경할까요?`)) {
      return;
    }
    setSaving(true);
    try {
      const { before } = await changeInstitutionManager({
        institutionId: institution.id,
        managerId: managerId || null,
      });
      const name = institution.name || "기관";
      if (managerId) {
        try {
          await sendPushEvent(scheduleSupabase, "institution_teacher_assigned", {
            teacher_id: managerId,
            body: `${name} 담당이 배정됐습니다`,
            institution_name: name,
          });
        } catch (_) { /* ignore */ }
      }
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

  return (
    <div className="sch-modal-overlay" onClick={() => !saving && onClose?.()}>
      <div
        className="sch-modal sch-modal--wide"
        onClick={e => e.stopPropagation()}
      >
        <div className="sch-modal-head">
          <h3>담당자 변경</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose} disabled={saving}>
            <X size={18}/>
          </button>
        </div>

        <form className="sch-form sch-form--flush" onSubmit={handleManagerSave}>
            <div className="sch-field">
              <span>현재 담당자 (관리자)</span>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {formatInstitutionManagerLabel(currentManager)}
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
              >
                {showHqOption ? (
                  <option value="">{HQ_MANAGER_LABEL}</option>
                ) : (
                  <option value="">선택하세요</option>
                )}
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
      </div>
    </div>
  );
}
