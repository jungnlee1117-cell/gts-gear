import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import {
  BILLING_TYPES, CLASS_TYPES, CONTRACT_TYPES, DAY_LABELS,
  EXCEPTION_LABELS, sortSlotsByTime,
} from "./constants.js";
import {
  deleteScheduleException,
  deleteWeeklySlot,
  fetchAssignments,
  fetchInstitution,
  fetchScheduleExceptions,
  fetchTeachers,
  fetchWeeklySchedule,
  saveScheduleException,
  saveWeeklySlot,
  upsertInstitution,
} from "./api.js";
import InstitutionAssignmentsTab from "./InstitutionAssignmentsTab.jsx";
import InstitutionBillingTab from "./InstitutionBillingTab.jsx";
import InstitutionTeacherTransferModal from "./InstitutionTeacherTransferModal.jsx";
import { filterClassTeacherAssignments } from "./assignmentRoles.js";
import { formatExceptionNotice } from "./scheduleExceptions.js";
import { notifyEventScheduled } from "./pushScheduleNotification.js";
import { isScheduleAdmin } from "./roles.js";
import {
  canViewInstitutionRevenue,
  institutionInManagerScope,
  isScheduleSuperAdmin,
} from "./managerScope.js";

const TABS = ["기본정보", "시간표", "계약/매출", "수업 선생님"];

export default function InstitutionDetailView({ institutionId, onBack, me }) {
  const [tab, setTab] = useState("기본정보");
  const [inst, setInst] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTab, setTransferTab] = useState("manager");
  const [exForm, setExForm] = useState({
    start_date: "",
    end_date: "",
    note: "",
    exception_type: "cancelled",
  });
  const [exSaving, setExSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [i, ts, w, ex, a] = await Promise.all([
        fetchInstitution(institutionId),
        fetchTeachers(),
        fetchWeeklySchedule(institutionId),
        fetchScheduleExceptions(institutionId),
        fetchAssignments(institutionId),
      ]);
      setInst(i);
      setTeachers(ts);
      setWeekly(sortSlotsByTime(w));
      setExceptions(ex);
      setAssignments(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [institutionId]);

  const saveInfo = async (e) => {
    e.preventDefault();
    try {
      await upsertInstitution(inst);
      alert("저장되었습니다.");
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
  };

  const addWeeklySlot = async () => {
    try {
      await saveWeeklySlot({
        institution_id: institutionId,
        day_of_week: 1,
        class_type: "정규",
        start_time: "09:00",
        end_time: "10:00",
        sort_order: weekly.length,
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const addException = async (e) => {
    e.preventDefault();
    if (!exForm.start_date) return alert("시작 날짜를 입력해주세요.");
    if (!exForm.note.trim()) return alert("메모를 입력해주세요.");
    const end = exForm.end_date || exForm.start_date;
    if (end < exForm.start_date) return alert("종료일은 시작일 이후여야 합니다.");
    setExSaving(true);
    try {
      await saveScheduleException({
        institution_id: institutionId,
        exception_date: exForm.start_date,
        end_date: exForm.end_date && exForm.end_date !== exForm.start_date ? exForm.end_date : null,
        exception_type: exForm.exception_type,
        note: exForm.note.trim(),
      });
      void notifyEventScheduled({
        institution_id: institutionId,
        note: exForm.note.trim(),
        event_date: exForm.start_date,
      });
      setExForm({ start_date: "", end_date: "", note: "", exception_type: "cancelled" });
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setExSaving(false);
    }
  };

  const openTransfer = (which) => {
    setTransferTab(which);
    setTransferOpen(true);
  };

  if (loading || !inst) return <p className="sch-muted">불러오는 중...</p>;

  if (!institutionInManagerScope(inst, me)) {
    return (
      <div className="sch-view">
        <p className="sch-muted">이 원에 대한 접근 권한이 없습니다.</p>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onBack}>돌아가기</button>
      </div>
    );
  }

  const admins = teachers.filter(t => t.role === "admin" || t.role === "superadmin");
  const teacherList = teachers.filter(t => t.role === "teacher");
  const canEditContract = isScheduleSuperAdmin(me);
  const canManageRoles = isScheduleAdmin(me);
  const classTeachers = filterClassTeacherAssignments(assignments);
  const managerName = teachers.find(t => t.id === inst.manager_id)?.name || "미지정";

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 원 관리
        </button>
        <h2 className="sch-view-title">{inst.name}</h2>
        {canManageRoles ? (
          <div className="sch-header-actions">
            <button
              type="button"
              className="sch-btn sch-btn--ghost"
              onClick={() => openTransfer("manager")}
            >
              담당자 변경
            </button>
            <button
              type="button"
              className="sch-btn sch-btn--ghost"
              onClick={() => openTransfer("teacher")}
            >
              수업 선생님 변경
            </button>
            <button
              type="button"
              className="sch-btn sch-btn--ghost"
              onClick={() => setTab("수업 선생님")}
            >
              수업 선생님 추가/제거
            </button>
          </div>
        ) : null}
      </header>

      <div className="sch-tabs">
        {TABS.map(t => (
          <button key={t} type="button"
            className={`sch-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "기본정보" && (
        <form className="sch-form" onSubmit={saveInfo}>
          <div className="sch-field" style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12,
          }}>
            <span style={{ fontWeight: 700 }}>담당자 (관리자)</span>
            <p style={{ margin: "6px 0 0", fontWeight: 800, fontSize: 16 }}>{managerName}</p>
            <p className="sch-muted" style={{ margin: "4px 0 0" }}>
              해당 기관을 관리하는 관리자입니다. 오른쪽 상단 &quot;담당자 변경&quot;으로 변경할 수 있습니다.
            </p>
          </div>

          <div className="sch-field" style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12,
          }}>
            <span style={{ fontWeight: 700 }}>수업 선생님</span>
            {classTeachers.length === 0 ? (
              <p className="sch-muted" style={{ margin: "6px 0 0" }}>등록된 수업 선생님이 없습니다.</p>
            ) : (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {classTeachers.map(a => (
                  <li key={a.id} style={{ fontWeight: 600 }}>
                    {a.teachers?.name || "—"}
                    {(a.pay_types || []).length ? (
                      <span className="sch-muted"> · {(a.pay_types || []).join(", ")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="sch-muted" style={{ margin: "6px 0 0" }}>
              실제 수업을 진행하는 선생님입니다. &quot;수업 선생님&quot; 탭에서 추가·제거할 수 있습니다.
            </p>
          </div>

          <label className="sch-field"><span>이름</span>
            <input className="sch-input" value={inst.name || ""} onChange={e => setInst({ ...inst, name: e.target.value })}/>
          </label>
          <label className="sch-field"><span>주소</span>
            <input className="sch-input" value={inst.address || ""} onChange={e => setInst({ ...inst, address: e.target.value })}/>
          </label>
          <label className="sch-field"><span>주차정보</span>
            <input className="sch-input" value={inst.parking_info || ""} onChange={e => setInst({ ...inst, parking_info: e.target.value })}/>
          </label>
          <label className="sch-field"><span>사업자등록번호</span>
            <input className="sch-input" value={inst.business_registration_number || ""}
              onChange={e => setInst({ ...inst, business_registration_number: e.target.value })}/>
          </label>
          {canEditContract ? (
            <label className="sch-field">
              <span>담당 관리자 (고급)</span>
              <select className="sch-select" value={inst.manager_id || ""}
                onChange={e => setInst({ ...inst, manager_id: e.target.value || null })}>
                <option value="">선택</option>
                {admins.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="sch-muted">슈퍼관리자만. 일반 변경은 &quot;담당자 변경&quot; 버튼을 사용하세요.</span>
            </label>
          ) : null}
          <label className="sch-field"><span>계약유형</span>
            <select className="sch-select" value={inst.contract_type}
              disabled={!canEditContract}
              onChange={e => setInst({ ...inst, contract_type: e.target.value })}>
              {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="sch-field"><span>과금방식</span>
            <select className="sch-select" value={inst.billing_type}
              disabled={!canEditContract}
              onChange={e => setInst({ ...inst, billing_type: e.target.value })}>
              {Object.entries(BILLING_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {inst.contract_type === "manager_fixed_payout" ? (
            <>
              <label className="sch-field"><span>고정지급 대상자</span>
                <select className="sch-select" value={inst.fixed_payout_recipient_id || ""}
                  disabled={!canEditContract}
                  onChange={e => setInst({ ...inst, fixed_payout_recipient_id: e.target.value || null })}>
                  <option value="">선택</option>
                  {[...admins, ...teacherList].map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="sch-field"><span>고정지급액 (부가세 제외)</span>
                <input type="number" className="sch-input" min={0}
                  disabled={!canEditContract}
                  value={inst.fixed_payout_amount ?? ""}
                  onChange={e => setInst({
                    ...inst,
                    fixed_payout_amount: e.target.value === "" ? null : Number(e.target.value),
                  })}/>
              </label>
            </>
          ) : null}
          <button type="submit" className="sch-btn sch-btn--primary">저장</button>
        </form>
      )}

      {tab === "시간표" && (
        <div>
          <button type="button" className="sch-btn sch-btn--ghost" onClick={addWeeklySlot}>
            <Plus size={14}/> 슬롯 추가
          </button>
          <ul className="sch-slot-edit-list">
            {weekly.map(slot => (
              <li key={slot.id} className="sch-slot-edit-item">
                <select value={slot.day_of_week} onChange={async e => {
                  await saveWeeklySlot({ ...slot, day_of_week: Number(e.target.value) });
                  load();
                }}>
                  {DAY_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
                <select value={slot.class_type} onChange={async e => {
                  await saveWeeklySlot({ ...slot, class_type: e.target.value });
                  load();
                }}>
                  {CLASS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="time" value={slot.start_time?.slice(0, 5)} onChange={async e => {
                  await saveWeeklySlot({ ...slot, start_time: e.target.value });
                  load();
                }}/>
                <input type="time" value={slot.end_time?.slice(0, 5)} onChange={async e => {
                  await saveWeeklySlot({ ...slot, end_time: e.target.value });
                  load();
                }}/>
                <select value={slot.teacher_id || ""} onChange={async e => {
                  await saveWeeklySlot({ ...slot, teacher_id: e.target.value || null });
                  load();
                }}>
                  <option value="">수업 선생님</option>
                  {teacherList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" className="sch-icon-btn" onClick={async () => {
                  await deleteWeeklySlot(slot.id);
                  load();
                }}><Trash2 size={14}/></button>
              </li>
            ))}
          </ul>

          <h4 className="sch-subtitle">휴원/행사 안내</h4>
          <p className="sch-muted">단일 날짜 또는 기간 + 메모. 강사 캘린더 하단에 이번 달 안내로 표시됩니다.</p>
          <ul className="sch-entry-list">
            {exceptions.map(ex => (
              <li key={ex.id} className="sch-entry-item">
                <span>{formatExceptionNotice(ex)}</span>
                <button type="button" className="sch-icon-btn" onClick={async () => {
                  if (!confirm("이 안내를 삭제할까요?")) return;
                  await deleteScheduleException(ex.id);
                  load();
                }}><Trash2 size={14}/></button>
              </li>
            ))}
          </ul>
          <form className="sch-form sch-exception-form" onSubmit={addException}>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작일</span>
                <input type="date" className="sch-input" required
                  value={exForm.start_date}
                  onChange={e => setExForm(f => ({ ...f, start_date: e.target.value }))}/>
              </label>
              <label className="sch-field">
                <span>종료일 (선택)</span>
                <input type="date" className="sch-input"
                  value={exForm.end_date}
                  onChange={e => setExForm(f => ({ ...f, end_date: e.target.value }))}/>
              </label>
            </div>
            <label className="sch-field">
              <span>유형</span>
              <select className="sch-select" value={exForm.exception_type}
                onChange={e => setExForm(f => ({ ...f, exception_type: e.target.value }))}>
                {Object.entries(EXCEPTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="sch-field">
              <span>메모</span>
              <input type="text" className="sch-input" required placeholder="예: 방학기간, 유치원 행사로 휴원"
                value={exForm.note}
                onChange={e => setExForm(f => ({ ...f, note: e.target.value }))}/>
            </label>
            <button type="submit" className="sch-btn sch-btn--ghost" disabled={exSaving}>
              {exSaving ? "저장 중..." : "안내 추가"}
            </button>
          </form>
        </div>
      )}

      {tab === "계약/매출" && (
        <InstitutionBillingTab
          institution={inst}
          institutionId={institutionId}
          canViewRevenue={canViewInstitutionRevenue(me, inst)}
        />
      )}

      {tab === "수업 선생님" && (
        <InstitutionAssignmentsTab
          institutionId={institutionId}
          assignments={assignments}
          teacherList={teacherList}
          onRefresh={load}
        />
      )}

      {transferOpen ? (
        <InstitutionTeacherTransferModal
          key={transferTab}
          institution={inst}
          assignments={assignments}
          weekly={weekly}
          teachers={teachers}
          teacherList={teacherList}
          adminList={admins}
          initialTab={transferTab}
          onClose={() => setTransferOpen(false)}
          onDone={load}
        />
      ) : null}
    </div>
  );
}
