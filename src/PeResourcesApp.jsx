import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Users, Trophy, Languages, ClipboardList, PartyPopper,
  Baby, GraduationCap, Video, ChevronLeft, Search, X, Upload, Download,
  Pencil, Trash2, Eye, Settings, Plus,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const PE_ADMIN = (u) => u?.role === "superadmin" || u?.role === "admin";
const PE_SUPER = (u) => u?.role === "superadmin";

const QUICK_TAGS = ["4세 균형", "축구", "영어체육", "점프활동", "공놀이", "밸런스"];

const DEFAULT_PE_CATEGORIES = [
  { id: "age-program", num: 1, title: "연령별 프로그램", color: "#22c55e", bg: "#ecfdf5",
    items: ["3, 4세 프로그램", "5, 6세 프로그램", "7세 프로그램"], subs: ["3-4세", "5-6세", "7세"], icon: "users" },
  { id: "sports", num: 2, title: "스포츠 종목 자료", color: "#3b82f6", bg: "#eff6ff",
    items: ["축구", "농구", "테니스", "배드민턴", "티볼", "체조"], subs: ["축구", "농구", "테니스", "배드민턴", "티볼", "체조"], icon: "ball" },
  { id: "english-pe", num: 3, title: "영어체육 자료", color: "#8b5cf6", bg: "#f5f3ff",
    items: ["TPR 표현", "주제별 표현", "영어 게임", "영어 노래", "영어 대본", "영어 체육 활동"],
    subs: ["TPR", "주제별", "게임", "노래", "대본", "활동"], icon: "abc" },
  { id: "lesson-plan", num: 4, title: "수업 계획안", color: "#2563eb", bg: "#eff6ff",
    items: ["연간 수업 계획안", "어린이집 수업 계획안", "영어유치원 수업 계획안"],
    subs: ["연간", "어린이집", "영어유치원"], icon: "clipboard" },
  { id: "events", num: 5, title: "행사 자료", color: "#ec4899", bg: "#fdf2f8",
    items: ["운동회", "물놀이", "할로윈", "크리스마스", "가족참여수업", "아빠참여수업"],
    subs: ["운동회", "물놀이", "할로윈", "크리스마스", "가족참여", "아빠참여"], icon: "party" },
  { id: "child-dev", num: 6, title: "아동 발달 자료", color: "#f97316", bg: "#fff7ed",
    items: ["연령별 발달", "사회성 발달", "신체 발달", "운동 발달"], subs: ["연령별", "사회성", "신체", "운동"], icon: "smile" },
  { id: "teacher-ed", num: 7, title: "교사 교육 자료", color: "#14b8a6", bg: "#f0fdfa",
    items: ["신입교사 교육", "안전 교육", "수업 운영", "교구 교육", "기관 안내"],
    subs: ["신입교사", "안전", "수업운영", "교구", "기관"], icon: "grad" },
  { id: "videos", num: 8, title: "영상 자료실", color: "#0ea5e9", bg: "#f0f9ff",
    items: ["수업 영상", "교구 활용 영상", "행사 영상", "영어체육 영상", "교육 콘텐츠"],
    subs: ["수업", "교구", "행사", "영어체육", "교육"], icon: "video" },
];

const CATEGORY_ICONS = {
  users: Users, ball: Trophy, abc: Languages, clipboard: ClipboardList,
  party: PartyPopper, smile: Baby, grad: GraduationCap, video: Video,
};

const ICON_OPTIONS = [
  { value: "users", label: "사용자" },
  { value: "ball", label: "스포츠" },
  { value: "abc", label: "언어" },
  { value: "clipboard", label: "클립보드" },
  { value: "party", label: "행사" },
  { value: "smile", label: "아동" },
  { value: "grad", label: "교육" },
  { value: "video", label: "영상" },
];

const COLOR_PALETTE = [
  { color: "#22c55e", bg: "#ecfdf5" }, { color: "#3b82f6", bg: "#eff6ff" },
  { color: "#8b5cf6", bg: "#f5f3ff" }, { color: "#2563eb", bg: "#eff6ff" },
  { color: "#ec4899", bg: "#fdf2f8" }, { color: "#f97316", bg: "#fff7ed" },
  { color: "#14b8a6", bg: "#f0fdfa" }, { color: "#0ea5e9", bg: "#f0f9ff" },
];

const ALLOWED_FILE_ACCEPT = [
  ".pdf", ".doc,.docx", ".xls,.xlsx", ".hwp,.hwpx", ".mp3,.wav,.m4a", "image/*", "video/*",
].join(",");

const ALLOWED_FILE_HINT =
  "PDF · Word(.doc, .docx) · 엑셀(.xlsx, .xls) · 한글(.hwp, .hwpx) · 이미지 · 영상 · 음원(.mp3, .wav, .m4a)";

const peLbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 };
const peInp = {
  width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
  fontSize: 14, marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box",
};
const pePrimaryBtn = {
  padding: "13px 20px", borderRadius: 10, border: "none", background: "#22c55e",
  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
};

function rowToCategory(row) {
  return {
    id: row.id,
    num: row.num,
    title: row.title,
    color: row.color,
    bg: row.bg,
    items: row.items || [],
    subs: row.subs || [],
    icon: row.icon || "clipboard",
  };
}

function slugify(text) {
  return String(text || "").trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .slice(0, 40) || `cat-${Date.now()}`;
}

function getFileExtension(name) {
  const i = String(name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function isAllowedFile(file) {
  if (!file) return false;
  const ext = getFileExtension(file.name);
  const allowed = [".pdf", ".doc", ".docx", ".xlsx", ".xls", ".hwp", ".hwpx", ".mp3", ".wav", ".m4a"];
  if (allowed.includes(ext)) return true;
  if (file.type.startsWith("image/")) return true;
  if (file.type.startsWith("video/")) return true;
  if (file.type.startsWith("audio/")) return true;
  return false;
}

function detectFileType(file) {
  if (!file) return "other";
  const ext = getFileExtension(file.name);
  const type = file.type || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/") || [".mp3", ".wav", ".m4a"].includes(ext)) return "audio";
  if (type === "application/pdf" || ext === ".pdf") return "pdf";
  if ([".doc", ".docx"].includes(ext) || type.includes("wordprocessingml") || type === "application/msword") return "word";
  if ([".xls", ".xlsx"].includes(ext) || type.includes("spreadsheetml") || type === "application/vnd.ms-excel") return "excel";
  if ([".hwp", ".hwpx"].includes(ext) || type.includes("hwp")) return "hwp";
  return "other";
}

function fileTypeLabel(t) {
  const m = { pdf: "PDF", video: "영상", image: "이미지", word: "Word", excel: "엑셀", hwp: "한글", audio: "음원" };
  return m[t] || "파일";
}

function canEditResource(me, res) {
  if (!me || !res) return false;
  if (PE_ADMIN(me)) return true;
  return res.author_id === me.id;
}

function getStoragePath(fileUrl) {
  if (!fileUrl) return null;
  try {
    const url = new URL(fileUrl);
    const parts = url.pathname.split("/pe-resources/");
    if (parts[1]) return decodeURIComponent(parts[1]);
  } catch { /* ignore */ }
  const marker = "/pe-resources/";
  const i = fileUrl.indexOf(marker);
  if (i >= 0) return decodeURIComponent(fileUrl.slice(i + marker.length).split("?")[0]);
  return null;
}

function supportsInlinePreview(fileType) {
  return ["pdf", "image", "audio", "video"].includes(fileType);
}

function isOfficeNoPreview(fileType) {
  return ["word", "excel", "hwp"].includes(fileType);
}

async function fetchResources() {
  const { data, error } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
  if (error) { console.warn("resources fetch:", error.message); return []; }
  return data || [];
}

async function fetchCategories() {
  const { data, error } = await supabase.from("pe_categories").select("*").order("sort_order", { ascending: true });
  if (error || !data?.length) return DEFAULT_PE_CATEGORIES;
  return data.map(rowToCategory);
}

async function deleteResourceRecord(res) {
  const path = getStoragePath(res.file_url);
  if (path) {
    const { error: stErr } = await supabase.storage.from("pe-resources").remove([path]);
    if (stErr) console.warn("storage delete:", stErr.message);
  }
  const { error } = await supabase.from("resources").delete().eq("id", res.id);
  if (error) throw new Error(error.message);
}

function CategoryIcon({ type, color, size = 22 }) {
  const Icon = CATEGORY_ICONS[type] || ClipboardList;
  return <Icon size={size} strokeWidth={1.75} color={color} aria-hidden />;
}

function GtsPlatformLogo() {
  return (
    <span className="pe-res-platform-title">
      <span className="pe-res-platform-gts">GTS</span>
      <span className="pe-res-platform-label"> 통합 플랫폼</span>
    </span>
  );
}

function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="pe-res-overlay" onClick={onClose}>
      <div className={`pe-res-modal${wide ? " pe-res-modal-wide" : ""}`} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>{title}</h2>
          <button type="button" onClick={onClose} className="pe-res-modal-close" aria-label="닫기"><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ResourceUploadModal({ category, me, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [subcategory, setSubcategory] = useState(category?.subs?.[0] || "");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const submit = async () => {
    if (!title.trim()) return alert("자료명을 입력하세요");
    if (!file) return alert("파일을 선택하세요");
    if (!isAllowedFile(file)) return alert("허용되지 않는 파일 형식입니다.\n\n" + ALLOWED_FILE_HINT);
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${category.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pe-resources").upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: urlData } = supabase.storage.from("pe-resources").getPublicUrl(path);
      const tagList = tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
      const { error: insErr } = await supabase.from("resources").insert({
        category_id: category.id, subcategory: subcategory || null,
        title: title.trim(), description: description.trim(), tags: tagList,
        file_url: urlData.publicUrl, file_name: file.name,
        file_type: detectFileType(file), file_size: file.size,
        author_id: me.id, author_name: me.name,
      });
      if (insErr) throw new Error(insErr.message);
      alert("자료가 업로드되었습니다.");
      onSaved(); onClose();
    } catch (e) {
      alert("업로드 오류: " + (e.message || "알 수 없는 오류"));
    }
    setSaving(false);
  };

  return (
    <ModalShell title="자료 업로드" onClose={onClose}>
      <label style={peLbl}>자료명 *</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={peInp} placeholder="자료 제목"/>
      <label style={peLbl}>설명</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...peInp, minHeight: 80, resize: "vertical" }} placeholder="자료 설명"/>
      <label style={peLbl}>하위 분류</label>
      <select value={subcategory} onChange={e => setSubcategory(e.target.value)} style={peInp}>
        {(category?.subs || []).map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <label style={peLbl}>태그 (쉼표로 구분)</label>
      <input value={tags} onChange={e => setTags(e.target.value)} style={peInp} placeholder="예: 4세 균형, 축구"/>
      <label style={peLbl}>파일 *</label>
      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55, marginBottom: 8 }}>허용 형식: {ALLOWED_FILE_HINT}</div>
      <input ref={fileRef} type="file" accept={ALLOWED_FILE_ACCEPT} onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...peInp, padding: 10 }}/>
      {file && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>{file.name} ({Math.round(file.size / 1024)} KB)</div>}
      <button type="button" onClick={submit} disabled={saving} style={{ ...pePrimaryBtn, width: "100%" }}>
        {saving ? "업로드 중..." : "업로드"}
      </button>
    </ModalShell>
  );
}

function ResourceEditModal({ resource, onClose, onSaved }) {
  const [title, setTitle] = useState(resource.title || "");
  const [description, setDescription] = useState(resource.description || "");
  const [tags, setTags] = useState((resource.tags || []).join(", "));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return alert("자료명을 입력하세요");
    setSaving(true);
    try {
      const tagList = tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
      const { error } = await supabase.from("resources").update({
        title: title.trim(),
        description: description.trim(),
        tags: tagList,
        updated_at: new Date().toISOString(),
      }).eq("id", resource.id);
      if (error) throw new Error(error.message);
      alert("수정되었습니다.");
      onSaved(); onClose();
    } catch (e) {
      alert("수정 오류: " + (e.message || "알 수 없는 오류"));
    }
    setSaving(false);
  };

  return (
    <ModalShell title="자료 수정" onClose={onClose}>
      <label style={peLbl}>자료명 *</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={peInp}/>
      <label style={peLbl}>설명</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...peInp, minHeight: 80, resize: "vertical" }}/>
      <label style={peLbl}>태그 (쉼표로 구분)</label>
      <input value={tags} onChange={e => setTags(e.target.value)} style={peInp}/>
      <button type="button" onClick={submit} disabled={saving} style={{ ...pePrimaryBtn, width: "100%" }}>
        {saving ? "저장 중..." : "저장"}
      </button>
    </ModalShell>
  );
}

function ResourcePreviewModal({ resource, accent, onClose }) {
  const ft = resource.file_type;
  const url = resource.file_url;

  return (
    <div className="pe-res-overlay" onClick={onClose}>
      <div className="pe-res-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="pe-res-preview-header">
          <h2>{resource.title}</h2>
          <button type="button" onClick={onClose} className="pe-res-modal-close" aria-label="닫기"><X size={18}/></button>
        </div>
        <div className="pe-res-preview-body">
          {ft === "pdf" && url && (
            <iframe title={resource.title} src={url} className="pe-res-preview-pdf"/>
          )}
          {ft === "image" && url && (
            <img src={url} alt={resource.title} className="pe-res-preview-image"/>
          )}
          {ft === "audio" && url && (
            <div className="pe-res-preview-audio-wrap">
              <audio controls src={url} className="pe-res-preview-audio"/>
            </div>
          )}
          {ft === "video" && url && (
            <video controls src={url} className="pe-res-preview-video"/>
          )}
          {isOfficeNoPreview(ft) && (
            <div className="pe-res-preview-nosupport">
              <p>Word, 엑셀, 한글 파일은 브라우저에서 미리보기를 지원하지 않습니다.</p>
              <p style={{ fontSize: 13, color: "#94a3b8" }}>파일을 다운로드하여 확인해 주세요.</p>
              {url && (
                <a href={url} download={resource.file_name || undefined} className="pe-res-download-btn" style={{ background: accent, marginTop: 16 }}>
                  <Download size={15} strokeWidth={2.5}/> 다운로드
                </a>
              )}
            </div>
          )}
          {!supportsInlinePreview(ft) && !isOfficeNoPreview(ft) && (
            <div className="pe-res-preview-nosupport">
              <p>이 파일 형식은 미리보기를 지원하지 않습니다.</p>
              {url && (
                <a href={url} download={resource.file_name || undefined} className="pe-res-download-btn" style={{ background: accent, marginTop: 16 }}>
                  <Download size={15} strokeWidth={2.5}/> 다운로드
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryEditModal({ category, categories, onClose, onSaved }) {
  const isNew = !category?.id;
  const [title, setTitle] = useState(category?.title || "");
  const [icon, setIcon] = useState(category?.icon || "clipboard");
  const [subsText, setSubsText] = useState((category?.subs || []).join("\n"));
  const [itemsText, setItemsText] = useState((category?.items || category?.subs || []).join("\n"));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return alert("카테고리명을 입력하세요");
    const subs = subsText.split("\n").map(s => s.trim()).filter(Boolean);
    const items = itemsText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!subs.length) return alert("하위 분류를 1개 이상 입력하세요");
    setSaving(true);
    try {
      const palette = COLOR_PALETTE[categories.length % COLOR_PALETTE.length];
      if (isNew) {
        let id = slugify(title);
        if (categories.some(c => c.id === id)) id = `${id}-${Date.now()}`;
        const num = categories.length + 1;
        const { error } = await supabase.from("pe_categories").insert({
          id, num, title: title.trim(), color: palette.color, bg: palette.bg,
          items: items.length ? items : subs, subs, icon,
          sort_order: num, updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("pe_categories").update({
          title: title.trim(), icon,
          subs, items: items.length ? items : subs,
          updated_at: new Date().toISOString(),
        }).eq("id", category.id);
        if (error) throw new Error(error.message);
      }
      alert(isNew ? "카테고리가 추가되었습니다." : "카테고리가 수정되었습니다.");
      onSaved(); onClose();
    } catch (e) {
      alert("저장 오류: " + (e.message || "알 수 없는 오류"));
    }
    setSaving(false);
  };

  return (
    <ModalShell title={isNew ? "카테고리 추가" : "카테고리 수정"} onClose={onClose}>
      <label style={peLbl}>카테고리명 *</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={peInp}/>
      <label style={peLbl}>아이콘</label>
      <select value={icon} onChange={e => setIcon(e.target.value)} style={peInp}>
        {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <label style={peLbl}>하위 분류 * (한 줄에 하나)</label>
      <textarea value={subsText} onChange={e => setSubsText(e.target.value)} style={{ ...peInp, minHeight: 100, resize: "vertical" }} placeholder={"3-4세\n5-6세\n7세"}/>
      <label style={peLbl}>카드 표시 항목 (한 줄에 하나, 비우면 하위 분류와 동일)</label>
      <textarea value={itemsText} onChange={e => setItemsText(e.target.value)} style={{ ...peInp, minHeight: 100, resize: "vertical" }}/>
      <button type="button" onClick={submit} disabled={saving} style={{ ...pePrimaryBtn, width: "100%" }}>
        {saving ? "저장 중..." : "저장"}
      </button>
    </ModalShell>
  );
}

function CategoryManageModal({ categories, resources, onClose, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const handleDelete = async (cat) => {
    const count = resources.filter(r => r.category_id === cat.id).length;
    const msg = count > 0
      ? `"${cat.title}"에 ${count}개 자료가 있습니다.\n카테고리를 삭제하시겠습니까? (자료는 유지됩니다)`
      : `"${cat.title}" 카테고리를 삭제하시겠습니까?`;
    if (!confirm(msg)) return;
    try {
      const { error } = await supabase.from("pe_categories").delete().eq("id", cat.id);
      if (error) throw new Error(error.message);
      onRefresh();
    } catch (e) {
      alert("삭제 오류: " + (e.message || "알 수 없는 오류"));
    }
  };

  return (
    <>
      <ModalShell title="카테고리 관리" onClose={onClose} wide>
        <button type="button" onClick={() => setAdding(true)} className="pe-res-upload-btn" style={{ marginBottom: 16 }}>
          <Plus size={16}/> 카테고리 추가
        </button>
        <div className="pe-res-cat-manage-list">
          {categories.map(cat => {
            const count = resources.filter(r => r.category_id === cat.id).length;
            return (
              <div key={cat.id} className="pe-res-cat-manage-item">
                <div className="pe-res-cat-manage-info">
                  <CategoryIcon type={cat.icon} color={cat.color} size={20}/>
                  <div>
                    <div style={{ fontWeight: 700, color: "#111827" }}>{cat.num}. {cat.title}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{cat.subs.length}개 하위분류 · {count}개 자료</div>
                  </div>
                </div>
                <div className="pe-res-resource-actions">
                  <button type="button" className="pe-res-action-btn pe-res-action-edit" onClick={() => setEditing(cat)}>
                    <Pencil size={14}/> 수정
                  </button>
                  <button type="button" className="pe-res-action-btn pe-res-action-delete" onClick={() => handleDelete(cat)}>
                    <Trash2 size={14}/> 삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </ModalShell>
      {editing && (
        <CategoryEditModal category={editing} categories={categories} onClose={() => setEditing(null)} onSaved={onRefresh}/>
      )}
      {adding && (
        <CategoryEditModal category={null} categories={categories} onClose={() => setAdding(false)} onSaved={onRefresh}/>
      )}
    </>
  );
}

function ResourceListPage({ category, search, me, resources, loading, onRefresh }) {
  const [showUpload, setShowUpload] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [localSub, setLocalSub] = useState("ALL");
  const admin = PE_ADMIN(me);

  const filtered = useMemo(() => {
    let r = resources;
    if (category) r = r.filter(x => x.category_id === category.id);
    if (localSub !== "ALL") r = r.filter(x => x.subcategory === localSub || x.tags?.includes(localSub));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(x =>
        x.title?.toLowerCase().includes(q)
        || x.description?.toLowerCase().includes(q)
        || x.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return r;
  }, [resources, category, localSub, search]);

  const pageTitle = category ? category.title : "검색 결과";
  const accent = category?.color || "#22c55e";

  const handleDelete = async (res) => {
    if (!confirm(`"${res.title}" 자료를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    try {
      await deleteResourceRecord(res);
      onRefresh();
    } catch (e) {
      alert("삭제 오류: " + (e.message || "알 수 없는 오류"));
    }
  };

  const handlePreview = (res) => {
    if (isOfficeNoPreview(res.file_type)) {
      setPreviewTarget(res);
      return;
    }
    if (supportsInlinePreview(res.file_type) && res.file_url) {
      setPreviewTarget(res);
      return;
    }
    alert("미리보기를 지원하지 않는 형식입니다.");
  };

  return (
    <div className="pe-res-list-page">
      <div className="pe-res-list-header">
        <div className="pe-res-list-title-wrap">
          <h1 className="pe-res-list-title">{pageTitle}</h1>
          {search && <p className="pe-res-list-search-note">검색: &quot;{search}&quot;</p>}
        </div>
        {admin && category && (
          <button type="button" onClick={() => setShowUpload(true)} className="pe-res-upload-btn">
            <Upload size={16} strokeWidth={2.5}/> 자료 업로드
          </button>
        )}
      </div>

      {category?.subs?.length > 0 && (
        <div className="pe-res-sub-filters">
          <button type="button" onClick={() => setLocalSub("ALL")} style={peTagBtn(localSub === "ALL", accent)}>전체</button>
          {category.subs.map(s => (
            <button key={s} type="button" onClick={() => setLocalSub(s)} style={peTagBtn(localSub === s, accent)}>{s}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="pe-res-empty">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="pe-res-empty pe-res-empty-box">등록된 자료가 없습니다</div>
      ) : (
        <div className="pe-res-resource-list">
          {filtered.map(res => (
            <div key={res.id} className="pe-res-resource-item">
              <div className="pe-res-resource-type" style={{ background: `${accent}18`, color: accent }}>
                {fileTypeLabel(res.file_type)}
              </div>
              <div className="pe-res-resource-body">
                <div className="pe-res-resource-title">{res.title}</div>
                {res.description && <div className="pe-res-resource-desc">{res.description}</div>}
                <div className="pe-res-resource-meta">
                  {res.subcategory && <span className="pe-res-meta-tag">{res.subcategory}</span>}
                  {(res.tags || []).map(t => (
                    <span key={t} className="pe-res-meta-tag pe-res-meta-tag-accent" style={{ background: `${accent}14`, color: accent }}>{t}</span>
                  ))}
                  <span className="pe-res-meta-date">
                    {res.author_name || ""} · {res.created_at ? new Date(res.created_at).toLocaleDateString("ko-KR") : ""}
                  </span>
                </div>
              </div>
              <div className="pe-res-resource-actions">
                {res.file_url && (
                  <>
                    <button type="button" className="pe-res-action-btn pe-res-action-preview" onClick={() => handlePreview(res)}>
                      <Eye size={14}/> 미리보기
                    </button>
                    <a href={res.file_url} target="_blank" rel="noopener noreferrer" download={res.file_name || undefined}
                      className="pe-res-download-btn" style={{ background: accent }}>
                      <Download size={15} strokeWidth={2.5}/> 다운로드
                    </a>
                  </>
                )}
                {canEditResource(me, res) && (
                  <>
                    <button type="button" className="pe-res-action-btn pe-res-action-edit" onClick={() => setEditTarget(res)}>
                      <Pencil size={14}/> 수정
                    </button>
                    <button type="button" className="pe-res-action-btn pe-res-action-delete" onClick={() => handleDelete(res)}>
                      <Trash2 size={14}/> 삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && category && (
        <ResourceUploadModal category={category} me={me} onClose={() => setShowUpload(false)} onSaved={onRefresh}/>
      )}
      {editTarget && (
        <ResourceEditModal resource={editTarget} onClose={() => setEditTarget(null)} onSaved={onRefresh}/>
      )}
      {previewTarget && (
        <ResourcePreviewModal resource={previewTarget} accent={accent} onClose={() => setPreviewTarget(null)}/>
      )}
    </div>
  );
}

function peTagBtn(active, color) {
  return {
    padding: "8px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit",
    border: `1px solid ${active ? color : "#e2e8f0"}`,
    background: active ? `${color}14` : "#fff",
    color: active ? color : "#64748b",
  };
}

function CategoryCard({ cat, resourceCount, onGo }) {
  return (
    <div className="pe-res-card" style={{ "--card-accent": cat.color, "--card-bg": cat.bg }}
      onClick={() => onGo(cat)} role="button" tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onGo(cat)}>
      <div className="pe-res-card-stats">
        <span>{cat.subs.length}개 카테고리</span>
        <span>총 {resourceCount}개 자료</span>
      </div>
      <div className="pe-res-card-head">
        <div className="pe-res-card-icon"><CategoryIcon type={cat.icon} color={cat.color}/></div>
        <div className="pe-res-card-title">
          <span className="pe-res-card-num" style={{ color: cat.color }}>{cat.num}.</span>
          {cat.title}
        </div>
      </div>
      <ul className="pe-res-card-items">
        {cat.items.map(it => <li key={it} className="pe-res-card-item">{it}</li>)}
      </ul>
    </div>
  );
}

function HubView({ categories, resourceCounts, search, setSearch, onSearch, onTag, onGoCategory, me, onManageCategories }) {
  return (
    <>
      <div className="pe-res-hero">
        <div className="pe-res-hero-intro">
          <div className="pe-res-hero-title-row">
            <div>
              <h1 className="pe-res-page-title">체육자료실</h1>
              <p className="pe-res-page-desc">수업 준비에 필요한 모든 자료를 빠르게 검색하고 활용하세요.</p>
            </div>
            {PE_SUPER(me) && (
              <button type="button" className="pe-res-manage-cat-btn" onClick={onManageCategories}>
                <Settings size={16}/> 카테고리 관리
              </button>
            )}
          </div>
        </div>
        <div className="pe-res-search-section">
          <div className="pe-res-search">
            <Search size={18} strokeWidth={2} color="#94a3b8"/>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && onSearch()}
              placeholder="검색어를 입력하세요. (예. 4세 균형, 축구, 영어체육, 점프활동)"/>
          </div>
          <div className="pe-res-quick-tags">
            {QUICK_TAGS.map(tag => (
              <button key={tag} type="button" onClick={() => onTag(tag)} className="pe-res-quick-tag">{tag}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="pe-res-grid">
        {categories.map(cat => (
          <CategoryCard key={cat.id} cat={cat} resourceCount={resourceCounts[cat.id] || 0} onGo={onGoCategory}/>
        ))}
      </div>
    </>
  );
}

export default function PeResourcesApp({ me, onBack, onNavigate }) {
  const [view, setView] = useState("hub");
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_PE_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [showCatManage, setShowCatManage] = useState(false);

  const loadResources = async () => {
    const data = await fetchResources();
    setResources(data);
  };

  const loadCategories = async () => {
    const data = await fetchCategories();
    setCategories(data);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadCategories(), loadResources()]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const resourceCounts = useMemo(() => {
    const m = {};
    resources.forEach(r => { m[r.category_id] = (m[r.category_id] || 0) + 1; });
    return m;
  }, [resources]);

  const goCategory = (cat) => {
    const isEnglishPe = cat.id === "english-pe" || (cat.title || "").includes("영어체육");
    if (isEnglishPe) {
      onNavigate?.("/english-script");
      return;
    }
    setCategory(cat);
    setListSearch("");
    setView("list");
  };

  const goSearch = (q) => {
    setCategory(null);
    setListSearch(q);
    setView("list");
  };

  const goHub = () => { setView("hub"); setCategory(null); };

  const roleLabel = me?.role === "superadmin" ? "슈퍼관리자" : me?.role === "admin" ? "관리자" : "선생님";

  const activeCategory = category
    ? categories.find(c => c.id === category.id) || category
    : null;

  return (
    <div className="pe-resources-app">
      <header className="pe-res-header">
        <div className="pe-res-header-left">
          {view === "list" ? (
            <button type="button" className="pe-res-back-btn pe-res-back-btn-header" onClick={goHub}>
              <ChevronLeft size={18} strokeWidth={2.5}/> 체육자료실
            </button>
          ) : (
            <button type="button" className="pe-res-logo-btn" onClick={onBack}>
              <GtsPlatformLogo/>
            </button>
          )}
        </div>
        <div className="pe-res-user">
          <span style={{ fontSize: 13, color: "#64748b" }}>안녕하세요, <strong style={{ color: "#111827" }}>{me?.name}님</strong>!</span>
          <span className="pe-res-profile-btn">{roleLabel}</span>
        </div>
      </header>

      <main className="pe-res-main">
        {view === "hub" ? (
          <HubView
            categories={categories}
            resourceCounts={resourceCounts}
            search={search}
            setSearch={setSearch}
            onSearch={() => goSearch(search)}
            onTag={goSearch}
            onGoCategory={goCategory}
            me={me}
            onManageCategories={() => setShowCatManage(true)}
          />
        ) : (
          <ResourceListPage
            category={activeCategory}
            search={listSearch}
            me={me}
            resources={resources}
            loading={loading}
            onRefresh={loadAll}
          />
        )}
      </main>

      <footer className="pe-res-footer">© 2026 GTS. All rights reserved.</footer>

      {showCatManage && PE_SUPER(me) && (
        <CategoryManageModal
          categories={categories}
          resources={resources}
          onClose={() => setShowCatManage(false)}
          onRefresh={loadCategories}
        />
      )}
    </div>
  );
}
