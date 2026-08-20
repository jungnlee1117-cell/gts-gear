import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { changeInstitutionManager } from "./api.js";
import { filterClassTeacherAssignments } from "./assignmentRoles.js";
import {
  buildClassTypeTransferGroups,
  transferInstitutionTeachersByClassType,
} from "./transferInstitutionTeacher.js";
import { sendPushEvent } from "../pushNotifications.js";
import { scheduleSupabase } from "./api.js";
import { isTeacherVisibleInYearMonth } from "./teacherEmployment.js";
import { yearMonthKey } from "./constants.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentTeacherLabel(group) {
  if (!group?.currentTeachers?.length) return "미지정";
  return group.currentTeachers.map((t) => `${t.name} 선생님`).join(", ");
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
    )).filter(t => isTeacherVisibleInYearMonth(t, yearMonthKey()));
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

  const typeGroups = useMemo(
    () => buildClassTypeTransferGroups({
      weekly,
      assignments: classAssignments,
      teachers,
    }),
    [weekly, classAssignments, teachers],
  );

  const [commonDate, setCommonDate] = useState(todayISO);
  const [perTypeDates, setPerTypeDates] = useState(false);
  const [typeTeacherIds, setTypeTeacherIds] = useState({});
  const [typeDates, setTypeDates] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTypeDates((prev) => {
      const next = { ...prev };
      for (const group of typeGroups) {
        if (!next[group.classType]) next[group.classType] = commonDate;
      }
      return next;
    });
  }, [typeGroups, commonDate]);

  const teacherCandidates = useMemo(() => {
    const source = teacherList.length ? teacherList : teachers.filter(t => t.role === "teacher");
    let list = source.filter(t => isTeacherVisibleInYearMonth(t, yearMonthKey()));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => String(t.name || "").toLowerCase().includes(q));
    }
    return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  }, [teacherList, teachers, search]);

  const pendingTransfers = useMemo(() => {
    return typeGroups.flatMap((group) => {
      const toTeacherId = typeTeacherIds[group.classType] || "";
      if (!toTeacherId) return [];
      const currentIds = new Set(group.currentTeachers.map((t) => t.id));
      if (currentIds.size === 1 && currentIds.has(toTeacherId)) return [];
      return [{
        classType: group.classType,
        toTeacherId,
        transferDate: perTypeDates
          ? (typeDates[group.classType] || commonDate)
          : commonDate,
        toName: teacherCandidates.find((t) => t.id === toTeacherId)?.name
          || teacherList.find((t) => t.id === toTeacherId)?.name
          || "선택한 선생님",
        fromLabel: currentTeacherLabel(group),
      }];
    });
  }, [
    typeGroups, typeTeacherIds, typeDates, perTypeDates, commonDate,
    teacherCandidates, teacherList,
  ]);

  const handleTeacherTransfer = async (e) => {
    e.preventDefault();
    if (!typeGroups.length) {
      return alert("이관할 수업 유형이 없습니다. 시간표 또는 수업 선생님을 먼저 등록해 주세요.");
    }
    if (!pendingTransfers.length) {
      return alert("변경할 유형의 새 선생님을 선택해 주세요. 선택하지 않은 유형은 그대로 유지됩니다.");
    }
    if (pendingTransfers.some((row) => !row.transferDate)) {
      return alert("이관 시작일을 입력해 주세요.");
    }

    const lines = pendingTransfers
      .map((row) => `${row.classType}: ${row.fromLabel} → ${row.toName} 선생님 (${row.transferDate})`)
      .join("\n");
    if (!confirm(`${institution?.name || "기관"} 수업 선생님을 유형별로 변경할까요?\n\n${lines}\n\n선택하지 않은 유형은 기존 선생님이 유지됩니다.`)) {
      return;
    }

    setSaving(true);
    try {
      const result = await transferInstitutionTeachersByClassType({
        institutionId: institution.id,
        institutionName: institution.name,
        defaultTransferDate: commonDate,
        transfers: pendingTransfers.map(({ classType, toTeacherId, transferDate }) => ({
          classType,
          toTeacherId,
          transferDate,
        })),
      });
      alert(
        `수업 선생님 변경이 완료되었습니다.\n변경 유형: ${result.transferredTypes.join(", ") || "-"}\n이관된 시간표 슬롯: ${result.weeklyTransferred}건`,
      );
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
              수업 유형별로 새 선생님을 지정할 수 있습니다. 선택하지 않은 유형은 기존 선생님이 그대로 유지됩니다.
              교구 순환·급여 단가·담당 관리자는 변경하지 않습니다.
            </p>

            {typeGroups.length === 0 ? (
              <p className="sch-muted">등록된 수업 유형이 없습니다. 시간표 또는 &quot;수업 선생님&quot; 탭에서 먼저 추가해 주세요.</p>
            ) : (
              <>
                <label className="sch-field">
                  <span>새 선생님 검색</span>
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
                  <span>이관 시작일 (공통) *</span>
                  <input
                    type="date"
                    className="sch-input"
                    value={commonDate}
                    onChange={e => {
                      const next = e.target.value;
                      setCommonDate(next);
                      if (!perTypeDates) {
                        setTypeDates((prev) => {
                          const mapped = { ...prev };
                          for (const group of typeGroups) mapped[group.classType] = next;
                          return mapped;
                        });
                      }
                    }}
                    required
                  />
                </label>

                <label className="sch-transfer-date-toggle">
                  <input
                    type="checkbox"
                    checked={perTypeDates}
                    onChange={e => setPerTypeDates(e.target.checked)}
                  />
                  <span>유형별로 이관 시작일 다르게 설정</span>
                </label>

                <div className="sch-transfer-type-list">
                  {typeGroups.map((group) => {
                    const selectedId = typeTeacherIds[group.classType] || "";
                    return (
                      <div key={group.classType} className="sch-transfer-type-card">
                        <div className="sch-transfer-type-card-head">
                          <div className="sch-transfer-type-name">{group.classType}</div>
                          {selectedId ? (
                            <span className="sch-transfer-type-badge">변경</span>
                          ) : (
                            <span className="sch-transfer-type-badge sch-transfer-type-badge--keep">유지</span>
                          )}
                        </div>
                        <div className="sch-transfer-type-current">
                          현재: {currentTeacherLabel(group)}
                        </div>
                        {group.slotSummary ? (
                          <div className="sch-transfer-type-slots">{group.slotSummary}</div>
                        ) : (
                          <div className="sch-transfer-type-slots">등록된 시간표 슬롯 없음 (배정만 변경)</div>
                        )}
                        <label className="sch-field" style={{ marginBottom: 0 }}>
                          <span>새 선생님</span>
                          <select
                            className="sch-select"
                            value={selectedId}
                            onChange={e => setTypeTeacherIds((prev) => ({
                              ...prev,
                              [group.classType]: e.target.value,
                            }))}
                          >
                            <option value="">변경 안 함 (기존 유지)</option>
                            {teacherCandidates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name} 선생님</option>
                            ))}
                          </select>
                        </label>
                        {perTypeDates ? (
                          <label className="sch-field" style={{ marginBottom: 0, marginTop: 8 }}>
                            <span>{group.classType} 이관 시작일</span>
                            <input
                              type="date"
                              className="sch-input"
                              value={typeDates[group.classType] || commonDate}
                              onChange={e => setTypeDates((prev) => ({
                                ...prev,
                                [group.classType]: e.target.value,
                              }))}
                              required={Boolean(selectedId)}
                            />
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose} disabled={saving}>
                취소
              </button>
              <button
                type="submit"
                className="sch-btn sch-btn--primary"
                disabled={saving || typeGroups.length === 0}
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
