import { useEffect, useMemo, useState } from "react";
import {
  completeTeacherResignation,
  fetchActiveRentalsForTeacher,
  fetchUpcomingClassesByInstitution,
  todayLocalDateStr,
} from "./teacherResign.js";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatTime(t) {
  return t ? String(t).slice(0, 5) : "";
}

/**
 * 4단계 퇴직 처리 모달
 * App 내 Modal / Btn / DS / Inp styles 를 props로 받거나 인라인 사용
 */
export default function TeacherResignModal({
  teacher,
  me,
  teachers,
  Modal,
  Btn,
  DS,
  onClose,
  onComplete,
}) {
  const [step, setStep] = useState(1);
  const [resignDate, setResignDate] = useState(() => todayLocalDateStr());
  const [reason, setReason] = useState("");
  const [groups, setGroups] = useState([]);
  const [reassignments, setReassignments] = useState({});
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const successors = useMemo(
    () => (teachers || []).filter(t =>
      t.id !== teacher.id
      && t.role !== "superadmin"
      && t.active !== false
      && !t.resigned_at,
    ).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko")),
    [teachers, teacher.id],
  );

  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    setLoading(true);
    setErr("");
    fetchUpcomingClassesByInstitution(teacher.id, resignDate)
      .then(rows => {
        if (cancelled) return;
        setGroups(rows);
        setReassignments(prev => {
          const next = { ...prev };
          for (const g of rows) {
            const key = g.institutionId || "none";
            if (next[key] === undefined) next[key] = "";
          }
          return next;
        });
      })
      .catch(e => {
        if (!cancelled) setErr(e.message || "수업 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [step, teacher.id, resignDate]);

  useEffect(() => {
    if (step !== 3) return;
    let cancelled = false;
    setLoading(true);
    setErr("");
    fetchActiveRentalsForTeacher(teacher.id)
      .then(rows => {
        if (!cancelled) setRentals(rows);
      })
      .catch(e => {
        if (!cancelled) setErr(e.message || "교구 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [step, teacher.id]);

  const goNextFrom1 = () => {
    if (!resignDate) return setErr("퇴직일을 입력하세요.");
    if (!reason.trim()) return setErr("퇴직 사유를 입력하세요.");
    setErr("");
    setStep(2);
  };

  const handleFinish = async () => {
    setSaving(true);
    setErr("");
    try {
      const updated = await completeTeacherResignation({
        teacher,
        resignDate,
        reason,
        reassignments,
        institutionGroups: groups,
        actor: me,
        rentalItems: rentals,
      });
      onComplete?.(updated);
      setStep(4);
    } catch (e) {
      setErr(e.message || "퇴직 처리 실패");
    } finally {
      setSaving(false);
    }
  };

  const unassignedCount = groups.filter(g => {
    const key = g.institutionId || "none";
    return !reassignments[key];
  }).length;

  return (
    <Modal title={`퇴직 처리 · ${teacher.name}`} onClose={onClose} dismissible={!saving}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[1, 2, 3, 4].map(n => (
          <div
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: step >= n ? (DS?.primary || "#16a34a") : "#e2e8f0",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: DS?.textMuted || "#94a3b8", marginBottom: 14 }}>
        {step === 1 && "1단계 · 퇴직 정보"}
        {step === 2 && "2단계 · 남은 수업 재배정"}
        {step === 3 && "3단계 · 교구 반납 확인"}
        {step === 4 && "4단계 · 완료"}
      </div>

      {err ? (
        <div style={{
          background: "#fee2e2", color: "#dc2626", borderRadius: 8,
          padding: "10px 12px", fontSize: 12, fontWeight: 600, marginBottom: 12,
        }}>
          {err}
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            퇴직일 *
          </label>
          <input
            type="date"
            value={resignDate}
            onChange={e => setResignDate(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid #e2e8f0", marginBottom: 12, fontSize: 14,
            }}
          />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            사유 *
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="예: 개인 사정, 이직 등"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid #e2e8f0", marginBottom: 12, fontSize: 14,
              resize: "vertical",
            }}
          />
          <p style={{ fontSize: 12, color: DS?.textMuted || "#64748b", marginBottom: 16 }}>
            퇴직일 당일까지는 계정을 사용할 수 있으며, 다음날부터 로그인이 차단됩니다.
            데이터는 삭제되지 않고 보관됩니다.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn ghost onClick={onClose}>취소</Btn>
            <Btn onClick={goNextFrom1}>다음</Btn>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          {loading ? (
            <p style={{ fontSize: 13, color: "#64748b" }}>남은 수업을 불러오는 중...</p>
          ) : groups.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              퇴직일 이후 재배정이 필요한 예정 수업이 없습니다.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12, marginBottom: 16, maxHeight: 360, overflowY: "auto" }}>
              {groups.map(g => {
                const key = g.institutionId || "none";
                const assignee = reassignments[key] || "";
                return (
                  <div
                    key={key}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 12,
                      background: assignee ? "#f0fdf4" : "#fffbeb",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                      {g.institutionName}
                      {!assignee ? (
                        <span style={{
                          marginLeft: 8, fontSize: 11, fontWeight: 700,
                          color: "#b45309", background: "#fef3c7",
                          padding: "2px 6px", borderRadius: 99,
                        }}>
                          미배정
                        </span>
                      ) : null}
                    </div>
                    <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 12, color: "#475569" }}>
                      {g.slots.map(s => (
                        <li key={s.id}>
                          {DAY_LABELS[s.day_of_week]} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                          {" · "}{s.class_type}
                        </li>
                      ))}
                    </ul>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      후임 선생님
                    </label>
                    <select
                      value={assignee}
                      onChange={e => setReassignments(r => ({ ...r, [key]: e.target.value }))}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 8,
                        border: "1px solid #e2e8f0", fontSize: 13,
                      }}
                    >
                      <option value="">미배정 (슈퍼관리자 알림)</option>
                      {successors.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
          {unassignedCount > 0 ? (
            <p style={{ fontSize: 12, color: "#b45309", marginBottom: 12, fontWeight: 600 }}>
              미배정 기관 {unassignedCount}곳 — 완료 시 슈퍼관리자에게 알림이 갑니다.
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn ghost onClick={() => setStep(1)} disabled={saving}>이전</Btn>
            <Btn onClick={() => { setErr(""); setStep(3); }}>다음</Btn>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          {loading ? (
            <p style={{ fontSize: 13, color: "#64748b" }}>대여 교구를 불러오는 중...</p>
          ) : rentals.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              대여 중인 교구가 없습니다. 강제 반납할 항목이 없습니다.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600, marginBottom: 10 }}>
                아래 교구 {rentals.length}건을 강제 반납 처리합니다.
              </p>
              <ul style={{
                margin: "0 0 16px", padding: 12, background: "#fef2f2",
                borderRadius: 10, fontSize: 13, maxHeight: 240, overflowY: "auto",
              }}>
                {rentals.map(ri => (
                  <li key={ri.id} style={{ marginBottom: 4 }}>
                    {ri.items?.name || "교구"} × {ri.quantity}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn ghost onClick={() => setStep(2)} disabled={saving}>이전</Btn>
            <Btn
              danger
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? "처리 중..." : "퇴직 처리 완료"}
            </Btn>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#166534", marginBottom: 8 }}>
            퇴직 처리가 완료되었습니다
          </div>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
            {teacher.name} 선생님 · 퇴직일 {resignDate}
            <br />
            계정·수업·교구 기록이 보관되며 삭제되지 않습니다.
          </p>
          <Btn onClick={onClose}>닫기</Btn>
        </div>
      ) : null}
    </Modal>
  );
}
