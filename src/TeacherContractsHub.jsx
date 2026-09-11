import { useEffect, useRef, useState } from "react";
import { canUploadTeacherContract } from "./teacherProfile.js";
import MyProfileContractsTab from "./MyProfileContractsTab.jsx";

export default function TeacherContractsHub({ supabase, me }) {
  const editorRef = useRef(null);
  const [opened, setOpened] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const allowed = canUploadTeacherContract(me);
  useEffect(() => {
    if (!opened || !allowed) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      supabase.from("teachers").select("id, name, phone, contract_type").order("name"),
      supabase.from("teacher_contracts").select("id, teacher_id, title, status, start_date, end_date, signed_at").order("created_at", { ascending: false }),
    ]).then(([people, rows]) => {
      if (cancelled) return;
      if (people.error || rows.error) throw new Error("계약서 목록을 불러오지 못했습니다. 다시 시도해 주세요.");
      setTeachers(people.data || []);
      setContracts(rows.data || []);
    }).catch(() => { if (!cancelled) setError("계약서 목록을 불러오지 못했습니다. 다시 시도해 주세요."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [opened, allowed, supabase, refresh]);
  if (!allowed) return null;
  const teacher = teachers.find(t => t.id === teacherId);
  const names = new Map(teachers.map(t => [t.id, t.name]));
  const visible = contracts.filter(c => (!status || c.status === status) && `${names.get(c.teacher_id) || ""} ${c.title || ""}`.includes(query.trim()));
  return (
    <section className="my-profile-card" style={{ marginBottom: 24 }}>
      <div className="my-profile-section-head">
        <h2 className="my-profile-card-title">계약서</h2>
        <button type="button" className="my-profile-btn-mint" onClick={() => setOpened(!opened)} aria-expanded={opened}>
          {opened ? "접기" : "계약서 작성 · 보관함 열기"}
        </button>
      </div>
      <p className="my-profile-hint">선생님을 선택하고 금액·기간을 입력해 앱으로 서명을 요청하세요. 발송한 계약서와 서명 완료본을 이곳에서 확인할 수 있습니다.</p>
      {opened && <>
        {loading && <p role="status">불러오는 중...</p>}
        {error && <p role="alert">{error} <button type="button" onClick={() => setRefresh(n => n + 1)}>다시 시도</button></p>}
        {!loading && !error && <>
          <label className="my-profile-field" ref={editorRef}>
            <span>계약서를 작성하거나 확인할 선생님</span>
            <select className="my-profile-input" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
              <option value="">선생님 선택</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}{t.phone ? ` · ${t.phone}` : ""}</option>)}
            </select>
          </label>
          {teacher && <div style={{ marginTop: 20 }}>
            <p><strong>{teacher.name}</strong>{teacher.phone ? ` · ${teacher.phone}` : ""}</p>
            <MyProfileContractsTab key={teacher.id} supabase={supabase} me={me} teacherId={teacher.id} teacherName={teacher.name} teacherPhone={teacher.phone} teacherContractType={teacher.contract_type} canUpload canSign={me.id === teacher.id} onChanged={() => setRefresh(n => n + 1)} />
          </div>}
          <h3 style={{ marginTop: 28 }}>계약서 보관함</h3>
          <div className="my-profile-grid">
            <label className="my-profile-field"><span>이름·계약서 검색</span><input className="my-profile-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="선생님 이름" /></label>
            <label className="my-profile-field"><span>서명 상태</span><select className="my-profile-input" value={status} onChange={e => setStatus(e.target.value)}><option value="">전체</option><option value="서명대기">서명 대기</option><option value="서명완료">서명 완료</option></select></label>
          </div>
          <div className="my-profile-contract-list" style={{ marginTop: 16 }}>
            {visible.length === 0 && <p>표시할 계약서가 없습니다.</p>}
            {visible.map(c => <div className="my-profile-contract-row" key={c.id}>
              <div><strong>{names.get(c.teacher_id) || "선생님"}</strong><div>{c.title || "교육용역 위탁 계약서"}</div><div className="my-profile-hint">{c.start_date} ~ {c.end_date}{c.signed_at ? ` · 서명일 ${c.signed_at.slice(0, 10)}` : ""}</div></div>
              <span className={`my-profile-status my-profile-status--${c.status === "서명완료" ? "done" : "wait"}`}>{c.status === "서명완료" ? "서명 완료" : "서명 대기"}</span>
              <button type="button" className="my-profile-btn-ghost" onClick={() => { setTeacherId(c.teacher_id); editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>계약서 확인</button>
            </div>)}
          </div>
        </>}
      </>}
    </section>
  );
}
