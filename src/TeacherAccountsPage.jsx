import { useEffect, useMemo, useState } from "react";
import TeacherResignModal from "./TeacherResignModal.jsx";
import {
  isResignedTeacher,
  reactivateTeacher,
  updateResignationInfo,
} from "./teacherResign.js";

/**
 * 선생님관리 — 목록 + 상세 + 퇴직 처리
 * App.jsx 의 UI primitives(Btn, Modal, DS, card, …)를 props로 받습니다.
 */
export default function TeacherAccountsPage({
  me,
  teachers,
  setTeachers,
  ris,
  reqs,
  items,
  fetchTeachers,
  supabase,
  logAction: parentLogAction,
  PageShell,
  PageHeader,
  PAGE_META,
  Btn,
  Modal,
  DS,
  card,
  RoleBadge,
  DashStatCard,
  Empty,
  Inp2,
  Sel2,
  Fld,
  inp,
  fmt,
  isSuperAdmin,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", role: "teacher" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [showResigned, setShowResigned] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [editResign, setEditResign] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchTeachers();
        if (!cancelled && rows) setTeachers(rows);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [setTeachers, fetchTeachers]);

  const logAction = async (type, action, target) => {
    if (parentLogAction) return parentLogAction(type, action, target);
    await supabase.from("activity_logs").insert({
      entity_type: type,
      entity_id: target.id,
      action,
      actor_id: me.id,
      actor_name: me.name,
      target_id: target.id,
      target_name: target.name,
    });
  };

  const loadLogs = async () => {
    const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50);
    setLogs(data || []);
    setLogOpen(true);
  };

  const promoteToItemAdmin = async (t) => {
    if (!confirm(`${t.name}을(를) 교구 관리자로 임명하시겠습니까?\n(스케줄·급여 관리 권한은 부여되지 않습니다)`)) return;
    const { error } = await supabase.from("teachers").update({ is_item_admin: true }).eq("id", t.id);
    if (error) { alert(error.message); return; }
    setTeachers(p => p.map(x => x.id === t.id ? { ...x, is_item_admin: true } : x));
    await logAction("role_change", "교구 관리자 임명", t);
    alert(`${t.name}이(가) 교구 관리자로 임명되었습니다`);
  };

  const demoteFromItemAdmin = async (t) => {
    if (!confirm(`${t.name}의 교구 관리자 권한을 해제하시겠습니까?`)) return;
    const { error } = await supabase.from("teachers").update({ is_item_admin: false }).eq("id", t.id);
    if (error) { alert(error.message); return; }
    setTeachers(p => p.map(x => x.id === t.id ? { ...x, is_item_admin: false } : x));
    await logAction("role_change", "교구 관리자 해제", t);
    alert(`${t.name}의 교구 관리자 권한이 해제되었습니다`);
  };

  const promoteToScheduleAdmin = async (t) => {
    if (!confirm(`${t.name}을(를) 스케줄 관리자로 임명하시겠습니까?\n(원 관리·급여·정산 — 교구 관리 권한도 함께 부여됩니다)`)) return;
    const { error } = await supabase.from("teachers").update({ role: "admin", is_item_admin: true }).eq("id", t.id);
    if (error) { alert(error.message); return; }
    setTeachers(p => p.map(x => x.id === t.id ? { ...x, role: "admin", is_item_admin: true } : x));
    await logAction("role_change", "스케줄 관리자 임명", t);
    alert(`${t.name}이(가) 스케줄 관리자로 임명되었습니다`);
  };

  const demoteToTeacher = async (t) => {
    if (!confirm(`${t.name}의 스케줄 관리자 권한을 해제하시겠습니까?`)) return;
    const { error } = await supabase.from("teachers").update({ role: "teacher" }).eq("id", t.id);
    if (error) { alert(error.message); return; }
    setTeachers(p => p.map(x => x.id === t.id ? { ...x, role: "teacher" } : x));
    await logAction("role_change", "스케줄 관리자 해제", t);
    alert(`${t.name}의 스케줄 관리자 권한이 해제되었습니다`);
  };

  const toggleActive = async (t) => {
    if (isResignedTeacher(t)) {
      alert("퇴직 선생님은 재활성화로만 다시 켤 수 있습니다.");
      return;
    }
    const next = !t.active;
    const msg = next ? "활성화" : "비활성화";
    if (!confirm(`${t.name} 계정을 ${msg}하시겠습니까?`)) return;
    const { error } = await supabase.from("teachers").update({ active: next }).eq("id", t.id);
    if (error) { alert(error.message); return; }
    setTeachers(p => p.map(x => x.id === t.id ? { ...x, active: next } : x));
    await logAction("account_status", `계정 ${msg}`, t);
  };

  const handleAdd = async () => {
    if (!f.name.trim()) { setErr("이름을 입력하세요"); return; }
    if (!f.email.trim()) { setErr("이메일을 입력하세요"); return; }
    if (f.password.length < 6) { setErr("비밀번호는 6자 이상이어야 합니다"); return; }
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { name: f.name.trim(), role: f.role, phone: f.phone.trim(), must_change_password: true } },
    });
    if (error) { setErr(error.message); setLoading(false); return; }
    if (!data?.user?.id) { setErr("계정 생성 실패"); setLoading(false); return; }
    await new Promise(r => setTimeout(r, 800));
    const { data: existing } = await supabase.from("teachers").select("id").eq("id", data.user.id).single();
    if (!existing) {
      await supabase.from("teachers").insert({
        id: data.user.id,
        name: f.name.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        role: f.role,
        active: true,
      });
    } else {
      await supabase.from("teachers").update({
        name: f.name.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        role: f.role,
        active: true,
      }).eq("id", data.user.id);
    }
    const { data: newT } = await supabase.from("teachers").select("*").eq("id", data.user.id).single();
    try {
      const rows = await fetchTeachers();
      if (rows?.length) setTeachers(rows);
      else if (newT) setTeachers(p => [...p.filter(x => x.id !== newT.id), { ...newT, email: f.email.trim() }]);
    } catch {
      if (newT) setTeachers(p => [...p.filter(x => x.id !== newT.id), { ...newT, email: f.email.trim() }]);
    }
    await logAction("account_create", "계정 생성", { id: data.user.id, name: f.name });
    setF({ name: "", phone: "", email: "", password: "", role: "teacher" });
    setAddOpen(false); setLoading(false);
    alert(`${f.name} 계정이 생성되었습니다!\n\n이메일: ${f.email}\n비밀번호: ${f.password}\n\n선생님께 직접 전달해 주세요.`);
  };

  const admins = teachers.filter(t => t.role === "admin" && (showResigned || !isResignedTeacher(t)));
  const itemAdmins = teachers.filter(t => t.is_item_admin && t.role !== "superadmin" && (showResigned || !isResignedTeacher(t)));
  const tList = teachers.filter(t => t.role === "teacher" && (showResigned || !isResignedTeacher(t)));
  const resignedCount = teachers.filter(isResignedTeacher).length;

  const detail = useMemo(
    () => teachers.find(t => t.id === detailId) || null,
    [teachers, detailId],
  );

  const sectionTitle = (text) => (
    <div style={{
      fontWeight: 700, fontSize: 12, color: DS.textSecondary,
      margin: "16px 0 8px", letterSpacing: "0.05em", textTransform: "uppercase",
    }}>{text}</div>
  );

  const AccountTeacherInfo = ({ t, showSelfBadge = false }) => {
    const email = (t.email && String(t.email).trim()) || "-";
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: DS.textPrimary }}>{t.name}</span>
          <RoleBadge role={t.role} isItemAdmin={t.is_item_admin} />
          {showSelfBadge && t.id === me.id && (
            <span style={{ background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>나</span>
          )}
          {isResignedTeacher(t) ? (
            <span style={{ background: "#e2e8f0", color: "#64748b", padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>퇴직</span>
          ) : t.active === false ? (
            <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>비활성</span>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: DS.textSecondary, marginTop: 5, lineHeight: 1.55 }}>
          <div>{t.phone || "-"}</div>
          <div style={{ color: DS.textMuted, marginTop: 2, wordBreak: "break-all" }}>{email}</div>
        </div>
      </div>
    );
  };

  const openResign = () => {
    if (!detail) return;
    if (!confirm("정말 퇴직 처리하시겠습니까?")) return;
    setResignOpen(true);
  };

  const handleReactivate = async () => {
    if (!detail) return;
    if (!confirm(`${detail.name} 선생님을 재활성화할까요?\n퇴직 정보가 해제됩니다.`)) return;
    setSavingEdit(true);
    try {
      const updated = await reactivateTeacher(detail.id);
      setTeachers(p => p.map(x => x.id === detail.id ? { ...x, ...updated } : x));
      await logAction("account_status", "퇴직 재활성화", detail);
      alert("재활성화되었습니다.");
    } catch (e) {
      alert(e.message || "재활성화 실패");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveResignEdit = async () => {
    if (!detail || !editResign) return;
    setSavingEdit(true);
    try {
      const updated = await updateResignationInfo(detail.id, {
        resigned_at: editResign.resigned_at,
        resignation_reason: editResign.resignation_reason,
      });
      setTeachers(p => p.map(x => x.id === detail.id ? { ...x, ...updated } : x));
      setEditResign(null);
      await logAction("account_status", "퇴직 정보 수정", detail);
      alert("저장되었습니다.");
    } catch (e) {
      alert(e.message || "저장 실패");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── 상세 페이지 ──
  if (detail) {
    const held = ris.filter(ri =>
      ["rented", "partial_returned"].includes(ri.status)
      && reqs.find(r => r.id === ri.request_id && r.teacher_id === detail.id),
    );
    const canResign = isSuperAdmin(me)
      && detail.role !== "superadmin"
      && !isResignedTeacher(detail)
      && detail.id !== me.id;

    return (
      <PageShell>
        <PageHeader
          me={me}
          subtitle={PAGE_META.accounts.sub}
          actions={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Btn sm ghost onClick={() => setDetailId(null)}>← 목록</Btn>
              {canResign ? (
                <Btn sm danger onClick={openResign}>퇴직 처리</Btn>
              ) : null}
            </div>
          }
        />

        <div style={{ ...card, marginBottom: 16 }}>
          <AccountTeacherInfo t={detail} showSelfBadge />
          <div style={{ marginTop: 14, fontSize: 13, color: DS.textSecondary, lineHeight: 1.6 }}>
            <div>보유 교구: {held.reduce((s, r) => s + r.quantity, 0)}개</div>
            {isResignedTeacher(detail) ? (
              <>
                <div>퇴직일: {String(detail.resigned_at).slice(0, 10)}</div>
                <div>사유: {detail.resignation_reason || "—"}</div>
              </>
            ) : null}
          </div>
        </div>

        {isResignedTeacher(detail) && isSuperAdmin(me) ? (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>퇴직 정보 관리</div>
            <p style={{ fontSize: 12, color: DS.textMuted, marginBottom: 12 }}>
              퇴직 선생님 데이터는 삭제할 수 없습니다. 퇴직일·사유 수정 또는 재활성화만 가능합니다.
            </p>
            {editResign ? (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>퇴직일</label>
                <input
                  type="date"
                  value={editResign.resigned_at || ""}
                  onChange={e => setEditResign(p => ({ ...p, resigned_at: e.target.value }))}
                  style={{ ...inp, marginBottom: 10 }}
                />
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>사유</label>
                <textarea
                  value={editResign.resignation_reason || ""}
                  onChange={e => setEditResign(p => ({ ...p, resignation_reason: e.target.value }))}
                  rows={3}
                  style={{ ...inp, marginBottom: 12, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn ghost sm onClick={() => setEditResign(null)}>취소</Btn>
                  <Btn sm onClick={handleSaveResignEdit} disabled={savingEdit}>
                    {savingEdit ? "저장 중..." : "저장"}
                  </Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn sm onClick={() => setEditResign({
                  resigned_at: detail.resigned_at ? String(detail.resigned_at).slice(0, 10) : "",
                  resignation_reason: detail.resignation_reason || "",
                })}>
                  퇴직 정보 수정
                </Btn>
                <Btn sm color="#16a34a" onClick={handleReactivate} disabled={savingEdit}>
                  재활성화
                </Btn>
              </div>
            )}
          </div>
        ) : null}

        {!isResignedTeacher(detail) && detail.role !== "superadmin" ? (
          <div style={{ ...card }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>권한</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280 }}>
              {detail.is_item_admin ? (
                <Btn sm ghost danger onClick={() => demoteFromItemAdmin(detail)}>교구 관리자 해제</Btn>
              ) : (
                <Btn sm color={DS.primary} onClick={() => promoteToItemAdmin(detail)}>교구 관리자 임명</Btn>
              )}
              {detail.role === "admin" ? (
                <Btn sm ghost danger onClick={() => demoteToTeacher(detail)}>스케줄 관리자 해제</Btn>
              ) : (
                <Btn sm ghost onClick={() => promoteToScheduleAdmin(detail)}>스케줄 관리자 임명</Btn>
              )}
              <Btn sm ghost color={detail.active === false ? "#16a34a" : "#dc2626"} onClick={() => toggleActive(detail)}>
                {detail.active === false ? "활성화" : "비활성화"}
              </Btn>
            </div>
          </div>
        ) : null}

        {resignOpen ? (
          <TeacherResignModal
            teacher={detail}
            me={me}
            teachers={teachers}
            Modal={Modal}
            Btn={Btn}
            DS={DS}
            onClose={() => setResignOpen(false)}
            onComplete={(updated) => {
              setTeachers(p => p.map(x => x.id === detail.id ? { ...x, ...updated } : x));
            }}
          />
        ) : null}
      </PageShell>
    );
  }

  // ── 목록 ──
  return (
    <PageShell>
      <PageHeader
        me={me}
        subtitle={PAGE_META.accounts.sub}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn
              sm
              ghost
              color={showResigned ? DS.primary : DS.textSecondary}
              onClick={() => setShowResigned(v => !v)}
            >
              {showResigned ? "퇴직 선생님 숨기기" : `퇴직 선생님 보기${resignedCount ? ` (${resignedCount})` : ""}`}
            </Btn>
            <Btn sm ghost color={DS.textSecondary} onClick={loadLogs}>로그</Btn>
            <Btn sm onClick={() => { setAddOpen(true); setErr(""); }}>+ 계정 추가</Btn>
          </div>
        }
      />

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
        gap: 14, marginBottom: 24,
      }}>
        <DashStatCard label="전체 사용자" value={teachers.length} iconMark="전체" iconBg={DS.primaryLight} iconColor={DS.primary} />
        <DashStatCard label="스케줄 관리자" value={admins.length} iconMark="관리" iconBg="#fee2e2" iconColor="#dc2626" />
        <DashStatCard label="교구 관리자" value={itemAdmins.length} iconMark="교구" iconBg="#dbeafe" iconColor="#1d4ed8" />
        <DashStatCard label="선생님" value={tList.filter(t => !t.is_item_admin).length} iconMark="선생" iconBg="#ede9fe" iconColor="#7c3aed" />
        <DashStatCard label="퇴직" value={resignedCount} iconMark="퇴직" iconBg="#f1f5f9" iconColor="#64748b" />
      </div>

      <div style={{
        background: "#fff7ed", border: "1px solid #fed7aa",
        borderRadius: 12, padding: "12px 14px",
        marginBottom: 16, fontSize: 12, color: "#9a3412", fontWeight: 600,
      }}>
        슈퍼관리자 전용 메뉴입니다. 선생님을 클릭하면 상세·퇴직 처리를 할 수 있습니다.
      </div>

      {sectionTitle("슈퍼관리자")}
      {teachers.filter(t => t.role === "superadmin").map(t => (
        <div key={t.id} style={{ ...card, borderLeft: "3px solid #854d0e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <AccountTeacherInfo t={t} showSelfBadge />
            <div style={{ fontSize: 11, color: DS.textMuted, fontWeight: 600 }}>변경 불가</div>
          </div>
        </div>
      ))}

      {sectionTitle(`스케줄 관리자 (${admins.length}명)`)}
      {admins.length === 0 && <div style={{ color: DS.textMuted, fontSize: 13, padding: "8px 0" }}>임명된 스케줄 관리자가 없습니다</div>}
      {admins.map(t => {
        const held = ris.filter(ri => ["rented", "partial_returned"].includes(ri.status) && reqs.find(r => r.id === ri.request_id && r.teacher_id === t.id));
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setDetailId(t.id)}
            style={{
              ...card,
              borderLeft: "3px solid #dc2626",
              opacity: t.active === false || isResignedTeacher(t) ? 0.55 : 1,
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <AccountTeacherInfo t={t} />
            <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 6 }}>보유 교구: {held.reduce((s, r) => s + r.quantity, 0)}개 · 클릭하여 상세</div>
          </button>
        );
      })}

      {sectionTitle(`선생님 (${tList.length}명)`)}
      {tList.map(t => {
        const held = ris.filter(ri => ["rented", "partial_returned"].includes(ri.status) && reqs.find(r => r.id === ri.request_id && r.teacher_id === t.id));
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setDetailId(t.id)}
            style={{
              ...card,
              opacity: t.active === false || isResignedTeacher(t) ? 0.55 : 1,
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <AccountTeacherInfo t={t} />
            <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 6 }}>보유: {held.reduce((s, r) => s + r.quantity, 0)}개 · 클릭하여 상세</div>
          </button>
        );
      })}

      {addOpen && (
        <Modal title="계정 추가" onClose={() => setAddOpen(false)}>
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 13px", marginBottom: 14, fontSize: 12, color: "#9a3412", fontWeight: 600 }}>
            생성 후 이메일과 비밀번호를 직접 선생님께 전달해주세요
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
            <Inp2 label="이름 *" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="홍길동" />
            <Inp2 label="연락처" value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} placeholder="010-0000-0000" />
          </div>
          <Inp2 label="이메일 *" type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="example@gts.com" />
          <Fld label="초기 비밀번호 * (6자 이상)">
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={f.password} onChange={e => setF(p => ({ ...p, password: e.target.value }))}
                placeholder="초기 비밀번호" style={{ ...inp, paddingRight: 50 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: DS.textMuted }}>{showPw ? "숨기기" : "보기"}</button>
            </div>
          </Fld>
          <Sel2 label="권한" value={f.role} onChange={e => setF(p => ({ ...p, role: e.target.value }))}>
            <option value="teacher">선생님</option>
            <option value="admin">스케줄 관리자</option>
          </Sel2>
          {err && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "10px 13px", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
          <Btn full onClick={handleAdd} disabled={loading}>{loading ? "생성 중..." : "계정 생성"}</Btn>
        </Modal>
      )}

      {logOpen && (
        <Modal title="활동 로그" onClose={() => setLogOpen(false)}>
          {logs.length === 0 ? <Empty text="기록이 없습니다" /> : logs.map(l => (
            <div key={l.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DS.textPrimary }}>{l.action}</div>
                  <div style={{ fontSize: 11, color: DS.textSecondary }}>처리자: {l.actor_name || "-"} {l.target_name ? `→ 대상: ${l.target_name}` : ""}</div>
                </div>
                <div style={{ fontSize: 10, color: DS.textMuted, whiteSpace: "nowrap", marginLeft: 8 }}>{fmt(l.created_at)}</div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </PageShell>
  );
}
