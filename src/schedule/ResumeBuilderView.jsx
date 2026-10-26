import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Printer, Save, Trash2, Plus } from "lucide-react";
import { scheduleSupabase, fetchTeachersUnfiltered } from "./api.js";

const EMPTY = {
  name_en: "",
  name_ko: "",
  company: "GTS SPORTS ACADEMY",
  title: "영어체육 담당 강사",
  profile: "",
  phone: "",
  email: "gtsletsgo@gmail.com",
  website: "gtssportsacadmey.imweb.me",
  education: "",
  experience: "",
  certificates: "",
  current_heading: "PE TEACHER",
  current_line: "Gts Sports Academy, South korea | 2025-Present",
  current_bullets: "Children’s sports company",
};

/** 사진을 가로세로 최대 700px JPEG 로 줄여서 data URL 로 반환 */
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지 형식을 읽지 못했습니다."));
      img.onload = () => {
        const max = 700;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function lines(text) {
  return String(text || "").split("\n").map(s => s.trimEnd()).filter(s => s.trim());
}

/** 경력처럼 항목 사이를 빈 줄로 나누면 항목별 간격을 둔다 */
function blocks(text) {
  return String(text || "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
}

export function ResumePaper({ data, photo }) {
  const nameEn = data.name_en || "";
  const nameKo = data.name_ko || "";
  const bullets = lines(data.current_bullets);
  return (
    <div className="resume-paper">
      <div className="resume-top">
        <div className="resume-photo">
          {photo ? <img src={photo} alt=""/> : <span>사진</span>}
        </div>
        <div className="resume-head">
          <div className="resume-name">
            {nameEn ? <div>{nameEn}</div> : null}
            {nameKo ? <div>{nameKo.startsWith("(") ? nameKo : `(${nameKo})`}</div> : null}
          </div>
          <div className="resume-rule"/>
          <div className="resume-band">
            <strong>{data.company}</strong>
            <span>{data.title}</span>
          </div>
        </div>
      </div>

      <div className="resume-grid">
        <section>
          <h3>PROFILE</h3>
          <p className="resume-text">{data.profile}</p>
        </section>
        <section>
          <h3>CONTACT</h3>
          <ul className="resume-contact">
            {data.phone ? <li><b>Phone Number :</b><span>{data.phone}</span></li> : null}
            {data.email ? <li><b>Email Address :</b><span>{data.email}</span></li> : null}
            {data.website ? <li><b>Website :</b><span>{data.website}</span></li> : null}
          </ul>
        </section>

        <section>
          <h3>EDUCATION</h3>
          <p className="resume-text resume-text--tight">{data.education}</p>
        </section>
        <section>
          <h3>EXPERIENCE</h3>
          {blocks(data.experience).map((b, i) => (
            <p key={i} className="resume-text resume-exp">{b}</p>
          ))}
        </section>

        <section>
          <h3>CERTIFICATES</h3>
          <p className="resume-text resume-text--tight">{data.certificates}</p>
        </section>
        <section>
          {data.current_heading ? <h3 className="resume-h3-muted">{data.current_heading}</h3> : null}
          {data.current_line ? <p className="resume-current">{data.current_line}</p> : null}
          {bullets.length ? (
            <ul className="resume-bullets">
              {bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="resume-field">
      <span>{label}</span>
      {children}
      {hint ? <em>{hint}</em> : null}
    </label>
  );
}

export default function ResumeBuilderView({ me, onBack }) {
  const [list, setList] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [data, setData] = useState({ ...EMPTY });
  const [photo, setPhoto] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);

  const loadList = async () => {
    const { data: rows, error } = await scheduleSupabase
      .from("resumes").select("id, title, teacher_id, updated_at").order("updated_at", { ascending: false });
    if (error) alert("이력서 목록을 불러오지 못했습니다: " + error.message);
    else setList(rows || []);
  };

  useEffect(() => {
    loadList();
    fetchTeachersUnfiltered()
      .then(rows => setTeachers((rows || []).filter(t => t.active !== false && !t.resigned_at)))
      .catch(() => {});
  }, []);

  const set = (k, v) => { setData(p => ({ ...p, [k]: v })); setDirty(true); };

  const startNew = () => {
    if (dirty && !window.confirm("저장하지 않은 내용이 사라집니다. 새로 만들까요?")) return;
    setCurrentId(null); setData({ ...EMPTY }); setPhoto(""); setTeacherId(""); setDirty(false);
  };

  const open = async (id) => {
    if (!id) return startNew();
    if (dirty && !window.confirm("저장하지 않은 내용이 사라집니다. 다른 이력서를 열까요?")) return;
    const { data: row, error } = await scheduleSupabase.from("resumes").select("*").eq("id", id).single();
    if (error) { alert("불러오기 실패: " + error.message); return; }
    setCurrentId(row.id);
    setData({ ...EMPTY, ...(row.data || {}) });
    setPhoto(row.photo_data || "");
    setTeacherId(row.teacher_id || "");
    setDirty(false);
  };

  const pickTeacher = (id) => {
    setTeacherId(id);
    const t = teachers.find(x => x.id === id);
    if (t) {
      setData(p => ({
        ...p,
        name_ko: p.name_ko || t.name || "",
        phone: p.phone || t.phone || "",
      }));
    }
    setDirty(true);
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await resizePhoto(file));
      setDirty(true);
    } catch (err) {
      alert(err.message || "사진을 불러오지 못했습니다.");
    }
    e.target.value = "";
  };

  const save = async () => {
    const title = (data.name_ko || data.name_en || "").trim();
    if (!title) { alert("이름을 입력해 주세요."); return; }
    setSaving(true);
    const payload = {
      title,
      teacher_id: teacherId || null,
      data,
      photo_data: photo || null,
      updated_at: new Date().toISOString(),
    };
    const res = currentId
      ? await scheduleSupabase.from("resumes").update(payload).eq("id", currentId).select("id").single()
      : await scheduleSupabase.from("resumes").insert({ ...payload, created_by: me?.id || null }).select("id").single();
    setSaving(false);
    if (res.error) { alert("저장 실패: " + res.error.message); return; }
    setCurrentId(res.data.id);
    setDirty(false);
    loadList();
  };

  const remove = async () => {
    if (!currentId) return;
    if (!window.confirm("이 이력서를 삭제할까요?")) return;
    const { error } = await scheduleSupabase.from("resumes").delete().eq("id", currentId);
    if (error) { alert("삭제 실패: " + error.message); return; }
    setCurrentId(null); setData({ ...EMPTY }); setPhoto(""); setTeacherId(""); setDirty(false);
    loadList();
  };

  const teacherOptions = useMemo(
    () => [...teachers].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko")),
    [teachers],
  );

  return (
    <div className="resume-view">
      <div className="resume-toolbar no-print">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onBack}><ChevronLeft size={15}/> 돌아가기</button>
        <h2>이력서 만들기</h2>
        <div className="resume-toolbar__actions">
          <select value={currentId || ""} onChange={e => open(e.target.value)}>
            <option value="">+ 새 이력서</option>
            {list.map(r => <option key={r.id} value={r.id}>{r.title || "(이름 없음)"}</option>)}
          </select>
          <button type="button" className="sch-btn sch-btn--ghost" onClick={startNew}><Plus size={14}/> 새로</button>
          <button type="button" className="sch-btn" disabled={saving} onClick={save}><Save size={14}/> {saving ? "저장 중..." : "저장"}</button>
          <button type="button" className="sch-btn" onClick={() => window.print()}><Printer size={14}/> 인쇄 / PDF 저장</button>
          {currentId ? <button type="button" className="sch-btn sch-btn--ghost" onClick={remove}><Trash2 size={14}/></button> : null}
        </div>
      </div>

      <div className="resume-layout">
        <div className="resume-form no-print">
          <Field label="선생님 연결 (선택)" hint="고르면 이름·전화가 채워집니다. 신규 지원자는 비워 두세요.">
            <select value={teacherId} onChange={e => pickTeacher(e.target.value)}>
              <option value="">선택 안 함</option>
              {teacherOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="사진" hint="가로·세로 비율은 자동으로 맞춰 잘립니다.">
            <div className="resume-photo-row">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => fileRef.current?.click()}>사진 선택</button>
              {photo ? <button type="button" className="sch-btn sch-btn--ghost" onClick={() => { setPhoto(""); setDirty(true); }}>사진 삭제</button> : null}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto}/>
            </div>
          </Field>
          <div className="resume-row2">
            <Field label="영문 이름"><input value={data.name_en} onChange={e => set("name_en", e.target.value)} placeholder="JIN"/></Field>
            <Field label="한글 이름"><input value={data.name_ko} onChange={e => set("name_ko", e.target.value)} placeholder="어욱진"/></Field>
          </div>
          <div className="resume-row2">
            <Field label="회사명"><input value={data.company} onChange={e => set("company", e.target.value)}/></Field>
            <Field label="직책"><input value={data.title} onChange={e => set("title", e.target.value)}/></Field>
          </div>
          <Field label="소개 (PROFILE)"><textarea rows={4} value={data.profile} onChange={e => set("profile", e.target.value)}/></Field>
          <div className="resume-row2">
            <Field label="전화"><input value={data.phone} onChange={e => set("phone", e.target.value)}/></Field>
            <Field label="이메일"><input value={data.email} onChange={e => set("email", e.target.value)}/></Field>
          </div>
          <Field label="웹사이트"><input value={data.website} onChange={e => set("website", e.target.value)}/></Field>
          <Field label="학력 (EDUCATION)" hint="한 줄에 하나씩 적으세요."><textarea rows={4} value={data.education} onChange={e => set("education", e.target.value)}/></Field>
          <Field label="경력 (EXPERIENCE)" hint="항목 사이는 빈 줄로 띄우세요."><textarea rows={7} value={data.experience} onChange={e => set("experience", e.target.value)}/></Field>
          <Field label="자격증 (CERTIFICATES)"><textarea rows={4} value={data.certificates} onChange={e => set("certificates", e.target.value)}/></Field>
          <div className="resume-row2">
            <Field label="현재 직무 제목"><input value={data.current_heading} onChange={e => set("current_heading", e.target.value)}/></Field>
            <Field label="현재 근무 (굵은 글씨)"><input value={data.current_line} onChange={e => set("current_line", e.target.value)}/></Field>
          </div>
          <Field label="현재 근무 설명" hint="한 줄에 하나씩, 글머리표로 표시됩니다."><textarea rows={3} value={data.current_bullets} onChange={e => set("current_bullets", e.target.value)}/></Field>
        </div>

        <div className="resume-preview">
          <div className="resume-preview__scale">
            <div id="resume-print-area">
              <ResumePaper data={data} photo={photo}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
