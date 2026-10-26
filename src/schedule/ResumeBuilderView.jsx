import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Printer, Save, Trash2, Plus, Upload } from "lucide-react";
import { scheduleSupabase, fetchTeachersUnfiltered } from "./api.js";
import {
  createTeacherDocumentType,
  fetchTeacherDocuments,
  fetchTeacherDocumentTypes,
  teacherDocumentsErrorMessage,
  uploadTeacherDocument,
} from "../teacherDocuments.js";

const RESUME_DOC_LABELS = { ko: "GTS 이력서 (국문)", en: "GTS 이력서 (영문)" };

const LABELS = {
  en: {
    profile: "PROFILE", contact: "CONTACT", education: "EDUCATION", experience: "EXPERIENCE", certificates: "CERTIFICATES",
    phone: "Phone Number :", email: "Email Address :", website: "Website :",
    title: "PE Instructor (English & PE)", heading: "PE TEACHER",
  },
  ko: {
    profile: "소개", contact: "연락처", education: "학력", experience: "경력", certificates: "자격증",
    phone: "전화번호 :", email: "이메일 :", website: "웹사이트 :",
    title: "영어체육 담당 강사", heading: "체육 교사",
  },
};

const EMPTY = {
  lang: "ko",
  show_profile_title: false,
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

const PHOTO_BG = "#d1d5db";
const MP_VERSION = "0.10.21";
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
let segmenterPromise = null;

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(MP_WASM);
      const make = (delegate) => ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate },
        runningMode: "IMAGE",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      try { return await make("GPU"); } catch { return await make("CPU"); }
    })().catch(err => { segmenterPromise = null; throw err; });
  }
  return segmenterPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    img.src = src;
  });
}

/** 사진에서 인물만 오려 회색 배경 위에 올린 JPEG data URL 반환 (실패 시 throw) */
async function cutoutOnGray(dataUrl) {
  const img = await loadImage(dataUrl);
  const w = img.width, h = img.height;
  const segmenter = await getSegmenter();
  const src = document.createElement("canvas");
  src.width = w; src.height = h;
  src.getContext("2d").drawImage(img, 0, 0);
  const result = segmenter.segment(src);
  try {
    const mask = result.confidenceMasks?.[0];
    if (!mask) throw new Error("인물을 찾지 못했습니다.");
    const mw = mask.width, mh = mask.height;
    const f = mask.getAsFloat32Array();
    // 중앙(사람이 있을 영역)과 가장자리 평균을 비교해 마스크 방향을 자동 판별
    let cs = 0, cn = 0, bs = 0, bn = 0;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const v = f[y * mw + x];
        const fx = x / mw, fy = y / mh;
        if (fx > 0.3 && fx < 0.7 && fy > 0.3 && fy < 0.7) { cs += v; cn++; }
        else if (fx < 0.08 || fx > 0.92 || fy < 0.08 || fy > 0.92) { bs += v; bn++; }
      }
    }
    const invert = cn && bn ? cs / cn < bs / bn : false;
    const mc = document.createElement("canvas");
    mc.width = mw; mc.height = mh;
    const mctx = mc.getContext("2d");
    const id = mctx.createImageData(mw, mh);
    let fg = 0;
    for (let i = 0; i < mw * mh; i++) {
      const p = invert ? 1 - f[i] : f[i];
      const a = Math.max(0, Math.min(1, (p - 0.5) * 8 + 0.5));
      id.data[i * 4 + 3] = Math.round(a * 255);
      fg += a;
    }
    const ratio = fg / (mw * mh);
    if (ratio < 0.04 || ratio > 0.97) throw new Error("인물을 찾지 못했습니다.");
    mctx.putImageData(id, 0, 0);
    const person = document.createElement("canvas");
    person.width = w; person.height = h;
    const pctx = person.getContext("2d");
    pctx.drawImage(img, 0, 0);
    pctx.globalCompositeOperation = "destination-in";
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = "high";
    pctx.drawImage(mc, 0, 0, w, h);
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const o = out.getContext("2d");
    o.fillStyle = PHOTO_BG;
    o.fillRect(0, 0, w, h);
    o.drawImage(person, 0, 0);
    return out.toDataURL("image/jpeg", 0.9);
  } finally {
    result.close?.();
  }
}

function lines(text) {
  return String(text || "").split("\n").map(s => s.trimEnd()).filter(s => s.trim());
}

/** 경력처럼 항목 사이를 빈 줄로 나누면 항목별 간격을 둔다 */
function blocks(text) {
  return String(text || "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
}

export function ResumePaper({ data, photo }) {
  const L = LABELS[data.lang === "en" ? "en" : "ko"];
  const nameEn = data.name_en || "";
  const nameKo = data.name_ko || "";
  const koWrapped = nameKo ? (nameKo.startsWith("(") ? nameKo : `(${nameKo})`) : "";
  const bullets = lines(data.current_bullets);
  const hasContact = data.phone || data.email || data.website;
  const expBlocks = blocks(data.experience);
  const onlyTitles = expBlocks.length > 0 && expBlocks.every(b => b.startsWith("## "));
  return (
    <div className="resume-paper">
      <img className="resume-logo" src="/brand/gts-logo-full.png" alt="GTS"/>
      <div className="resume-top">
        <div className="resume-photo">
          {photo ? <img src={photo} alt=""/> : <span>사진</span>}
        </div>
        <div className="resume-head">
          <div className="resume-name">
            {data.lang === "en" ? (
              <>
                {nameEn ? <div className="resume-name__en">{nameEn}</div> : null}
                {koWrapped ? <div className="resume-name__ko">{koWrapped}</div> : null}
              </>
            ) : (
              <>
                {nameKo ? <div className="resume-name__en">{nameKo}</div> : null}
                {nameEn ? <div className="resume-name__ko">{nameEn}</div> : null}
              </>
            )}
          </div>
          <div className="resume-rule"/>
          <div className="resume-band">
            <span>{data.company}</span>
            <span>{data.title}</span>
          </div>
        </div>
      </div>

      <div className="resume-cols">
        <div className="resume-col">
          {data.education ? (
            <section className="resume-sec">
              <h3>{L.education}</h3>
              <p className="resume-text resume-text--tight">{data.education}</p>
            </section>
          ) : null}
          {data.profile ? (
            <section className="resume-sec">
              {data.show_profile_title ? <h3>{L.profile}</h3> : null}
              <p className="resume-text resume-text--profile">{data.profile}</p>
            </section>
          ) : null}
          {data.certificates ? (
            <section className="resume-sec">
              <h3>{L.certificates}</h3>
              <p className="resume-text resume-text--tight">{data.certificates}</p>
            </section>
          ) : null}
        </div>
        <div className="resume-col">
          {hasContact ? (
            <section className="resume-sec">
              <h3>{L.contact}</h3>
              <ul className="resume-contact">
                {data.phone ? <li><b>{L.phone}</b><span>{data.phone}</span></li> : null}
                {data.email ? <li><b>{L.email}</b><span>{data.email}</span></li> : null}
                {data.website ? <li><b>{L.website}</b><span>{data.website}</span></li> : null}
              </ul>
            </section>
          ) : null}
          {expBlocks.length ? (
            <section className="resume-sec">
              {!onlyTitles ? <h3>{L.experience}</h3> : null}
              {expBlocks.map((b, i) => {
                if (b.startsWith("## ")) {
                  const [first, ...rest] = b.split("\n");
                  return (
                    <div key={i}>
                      <div className="resume-exp-title">{first.replace(/^##\s+/, "")}</div>
                      {rest.length ? <p className="resume-exp-body">{rest.join("\n")}</p> : null}
                    </div>
                  );
                }
                return <p key={i} className="resume-exp">{b}</p>;
              })}
            </section>
          ) : null}
          {(data.current_heading || data.current_line || bullets.length) ? (
            <section className="resume-sec">
              {data.current_heading ? <h3 className="resume-h3-muted">{data.current_heading}</h3> : null}
              {data.current_line ? <p className="resume-current">{data.current_line}</p> : null}
              {bullets.length ? (
                <ul className="resume-bullets">
                  {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
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
  const [photoOrig, setPhotoOrig] = useState("");
  const [cutout, setCutout] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);
  const captureRef = useRef(null);
  const [filing, setFiling] = useState(false);

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

  /** 언어를 바꾸면 기본 직책·직무 제목도 그 언어 기본값으로 바꾼다(직접 고친 값은 유지) */
  const switchLang = (lang) => {
    setData(p => {
      const from = LABELS[p.lang === "en" ? "en" : "ko"];
      const to = LABELS[lang];
      return {
        ...p,
        lang,
        title: p.title === from.title || !p.title ? to.title : p.title,
        current_heading: p.current_heading === from.heading || !p.current_heading ? to.heading : p.current_heading,
      };
    });
    setDirty(true);
  };

  /** 지금 내용을 그대로 복사해 새 이력서로 시작(언어만 바꿔 두 버전을 만들 때) */
  const duplicate = () => {
    setCurrentId(null);
    setDirty(true);
  };

  const startNew = () => {
    if (dirty && !window.confirm("저장하지 않은 내용이 사라집니다. 새로 만들까요?")) return;
    setCurrentId(null); setData({ ...EMPTY }); setPhoto(""); setPhotoOrig(""); setTeacherId(""); setDirty(false);
  };

  const open = async (id) => {
    if (!id) return startNew();
    if (dirty && !window.confirm("저장하지 않은 내용이 사라집니다. 다른 이력서를 열까요?")) return;
    const { data: row, error } = await scheduleSupabase.from("resumes").select("*").eq("id", id).single();
    if (error) { alert("불러오기 실패: " + error.message); return; }
    setCurrentId(row.id);
    setData({ ...EMPTY, ...(row.data || {}) });
    setPhoto(row.photo_data || ""); setPhotoOrig("");
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

  const applyPhoto = async (orig, useCutout) => {
    if (!useCutout) { setPhoto(orig); setDirty(true); return; }
    setPhotoBusy(true);
    try {
      setPhoto(await cutoutOnGray(orig));
    } catch (err) {
      console.error(err);
      setPhoto(orig);
      alert((err?.message || "배경 제거에 실패했습니다.") + "\n원본 사진을 그대로 사용합니다.");
    } finally {
      setPhotoBusy(false);
      setDirty(true);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const orig = await resizePhoto(file);
      setPhotoOrig(orig);
      await applyPhoto(orig, cutout);
    } catch (err) {
      alert(err.message || "사진을 불러오지 못했습니다.");
    }
    e.target.value = "";
  };

  const toggleCutout = async (on) => {
    setCutout(on);
    if (photoOrig) await applyPhoto(photoOrig, on);
  };

  const save = async () => {
    const baseTitle = (data.name_ko || data.name_en || "").trim();
    if (!baseTitle) { alert("이름을 입력해 주세요."); return; }
    const title = `${baseTitle} (${data.lang === "en" ? "EN" : "KO"})`;
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

  /** 이력서를 A4 PDF 로 만들어 선택한 선생님의 내정보 → 서류(이력서)에 저장 */
  const saveToDocuments = async () => {
    if (!teacherId) { alert("서류에 저장하려면 위에서 선생님을 먼저 연결해 주세요."); return; }
    const teacherName = teachers.find(t => t.id === teacherId)?.name || "선생님";
    if (!window.confirm(`${teacherName} 선생님의 내정보 > 서류(이력서)에 PDF로 저장할까요?\n이미 저장된 "${RESUME_DOC_LABELS[data.lang === "en" ? "en" : "ko"]}"가 있으면 새 파일로 바뀝니다.`)) return;
    setFiling(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const node = captureRef.current?.firstElementChild;
      if (!node) throw new Error("이력서 화면을 찾지 못했습니다.");
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#f4f4f4", useCORS: true });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
      const blob = pdf.output("blob");
      const baseName = (data.name_ko || data.name_en || teacherName).replace(/[\\/:*?"<>|]/g, "").trim() || "이력서";
      const file = new File([blob], `이력서_${baseName}_${data.lang === "en" ? "EN" : "KO"}.pdf`, { type: "application/pdf" });

      let types = await fetchTeacherDocumentTypes(scheduleSupabase);
      let type = types.find(t => t.is_active && String(t.label).includes("이력서"));
      if (!type) type = await createTeacherDocumentType(scheduleSupabase, { label: "이력서", allowsCustomLabel: true });
      const resumeLabel = RESUME_DOC_LABELS[data.lang === "en" ? "en" : "ko"];
      const { rows } = await fetchTeacherDocuments(scheduleSupabase, teacherId);
      const existing = rows.find(r => r.doc_type_id === type.id && r.doc_label === resumeLabel) || null;
      await uploadTeacherDocument(scheduleSupabase, {
        teacherId,
        uploadedBy: me?.id,
        docTypeId: type.id,
        docLabel: resumeLabel,
        file,
        existing,
      });
      alert(`${teacherName} 선생님의 내정보 > 서류에 "이력서" 로 저장했습니다.`);
    } catch (err) {
      alert("서류 저장 실패: " + teacherDocumentsErrorMessage(err));
    } finally {
      setFiling(false);
    }
  };

  const remove = async () => {
    if (!currentId) return;
    if (!window.confirm("이 이력서를 삭제할까요?")) return;
    const { error } = await scheduleSupabase.from("resumes").delete().eq("id", currentId);
    if (error) { alert("삭제 실패: " + error.message); return; }
    setCurrentId(null); setData({ ...EMPTY }); setPhoto(""); setPhotoOrig(""); setTeacherId(""); setDirty(false);
    loadList();
  };

  const teacherOptions = useMemo(
    () => [...teachers].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko")),
    [teachers],
  );

  return (
    <div className="resume-view">
      <div ref={captureRef} className="no-print" aria-hidden style={{ position: "fixed", left: "-10000px", top: 0, width: "210mm", height: "297mm", pointerEvents: "none" }}>
        <ResumePaper data={data} photo={photo}/>
      </div>
      <div className="resume-toolbar no-print">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onBack}><ChevronLeft size={15}/> 돌아가기</button>
        <h2>이력서 만들기</h2>
        <div className="resume-toolbar__actions">
          <select value={currentId || ""} onChange={e => open(e.target.value)}>
            <option value="">+ 새 이력서</option>
            {list.map(r => <option key={r.id} value={r.id}>{r.title || "(이름 없음)"}</option>)}
          </select>
          <button type="button" className="sch-btn sch-btn--ghost" onClick={startNew}><Plus size={14}/> 새로</button>
          {currentId ? <button type="button" className="sch-btn sch-btn--ghost" onClick={duplicate} title="내용을 복사해 새 이력서로 저장합니다(언어만 바꿔 두 버전 만들 때)">복사</button> : null}
          <button type="button" className="sch-btn" disabled={saving} onClick={save}><Save size={14}/> {saving ? "저장 중..." : "저장"}</button>
          <button type="button" className="sch-btn" onClick={() => window.print()}><Printer size={14}/> 인쇄 / PDF 저장</button>
          <button type="button" className="sch-btn" disabled={filing || !teacherId} title={teacherId ? "" : "선생님을 먼저 연결해 주세요"} onClick={saveToDocuments}><Upload size={14}/> {filing ? "저장 중..." : "선생님 서류에 저장"}</button>
          {currentId ? <button type="button" className="sch-btn sch-btn--ghost" onClick={remove}><Trash2 size={14}/></button> : null}
        </div>
      </div>

      <div className="resume-layout">
        <div className="resume-form no-print">
          <Field label="이력서 언어" hint="소제목(학력/EDUCATION 등)과 이름 배치가 바뀝니다. 내용은 직접 입력한 그대로 나옵니다.">
            <div className="resume-lang">
              <button type="button" className={data.lang === "ko" ? "is-on" : ""} onClick={() => switchLang("ko")}>한국어</button>
              <button type="button" className={data.lang === "en" ? "is-on" : ""} onClick={() => switchLang("en")}>English</button>
            </div>
          </Field>
          <Field label="선생님 연결 (선택)" hint="고르면 이름·전화가 채워집니다. 신규 지원자는 비워 두세요.">
            <select value={teacherId} onChange={e => pickTeacher(e.target.value)}>
              <option value="">선택 안 함</option>
              {teacherOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="사진" hint="가로·세로 비율은 자동으로 맞춰 잘립니다.">
            <div className="resume-photo-row">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => fileRef.current?.click()}>사진 선택</button>
              {photo ? <button type="button" className="sch-btn sch-btn--ghost" onClick={() => { setPhoto(""); setPhotoOrig(""); setDirty(true); }}>사진 삭제</button> : null}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto}/>
            </div>
            <label className="resume-check">
              <input type="checkbox" checked={cutout} disabled={photoBusy} onChange={e => toggleCutout(e.target.checked)}/>
              인물만 오려서 회색 배경에 올리기{photoBusy ? " (처리 중…)" : ""}
            </label>
          </Field>
          <div className="resume-row2">
            <Field label="영문 이름"><input value={data.name_en} onChange={e => set("name_en", e.target.value)} placeholder="JIN"/></Field>
            <Field label="한글 이름"><input value={data.name_ko} onChange={e => set("name_ko", e.target.value)} placeholder="어욱진"/></Field>
          </div>
          <div className="resume-row2">
            <Field label="회사명"><input value={data.company} onChange={e => set("company", e.target.value)}/></Field>
            <Field label="직책"><input value={data.title} onChange={e => set("title", e.target.value)}/></Field>
          </div>
          <Field label="소개">
            <textarea rows={5} value={data.profile} onChange={e => set("profile", e.target.value)}/>
            <label className="resume-check"><input type="checkbox" style={{ width: "auto" }} checked={!!data.show_profile_title} onChange={e => set("show_profile_title", e.target.checked)}/> 소개 제목(PROFILE/소개) 표시</label>
          </Field>
          <div className="resume-row2">
            <Field label="전화"><input value={data.phone} onChange={e => set("phone", e.target.value)}/></Field>
            <Field label="이메일"><input value={data.email} onChange={e => set("email", e.target.value)}/></Field>
          </div>
          <Field label="웹사이트"><input value={data.website} onChange={e => set("website", e.target.value)}/></Field>
          <Field label="학력 (EDUCATION)" hint="한 줄에 하나씩 적으세요."><textarea rows={4} value={data.education} onChange={e => set("education", e.target.value)}/></Field>
          <Field label="경력 (EXPERIENCE)" hint="항목 사이는 빈 줄로 띄우세요. 줄 맨 앞에 '## '을 붙이면 굵은 소제목이 됩니다. (소제목만 쓰면 EXPERIENCE 제목은 숨겨집니다)"><textarea rows={7} value={data.experience} onChange={e => set("experience", e.target.value)}/></Field>
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
