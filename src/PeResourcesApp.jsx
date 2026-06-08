import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Users, Trophy, Languages, ClipboardList, PartyPopper,
  Baby, GraduationCap, Video, ChevronLeft, Search, X, Upload, Download,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const PE_ADMIN = (u) => u?.role === "superadmin" || u?.role === "admin";

const QUICK_TAGS = ["4세 균형", "축구", "영어체육", "점프활동", "공놀이", "밸런스"];

const PE_CATEGORIES = [
  {
    id: "age-program",
    num: 1,
    title: "연령별 프로그램",
    color: "#22c55e",
    bg: "#ecfdf5",
    items: ["3, 4세 프로그램", "5, 6세 프로그램", "7세 프로그램"],
    subs: ["3-4세", "5-6세", "7세"],
    icon: "users",
    resourceCount: 42,
  },
  {
    id: "sports",
    num: 2,
    title: "스포츠 종목 자료",
    color: "#3b82f6",
    bg: "#eff6ff",
    items: ["축구", "농구", "테니스", "배드민턴", "티볼", "체조"],
    subs: ["축구", "농구", "테니스", "배드민턴", "티볼", "체조"],
    icon: "ball",
    resourceCount: 84,
  },
  {
    id: "english-pe",
    num: 3,
    title: "영어체육 자료",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    items: ["TPR 표현", "주제별 표현", "영어 게임", "영어 노래", "영어 대본", "영어 체육 활동"],
    subs: ["TPR", "주제별", "게임", "노래", "대본", "활동"],
    icon: "abc",
    resourceCount: 72,
  },
  {
    id: "lesson-plan",
    num: 4,
    title: "수업 계획안",
    color: "#2563eb",
    bg: "#eff6ff",
    items: ["연간 수업 계획안", "어린이집 수업 계획안", "영어유치원 수업 계획안"],
    subs: ["연간", "어린이집", "영어유치원"],
    icon: "clipboard",
    resourceCount: 24,
  },
  {
    id: "events",
    num: 5,
    title: "행사 자료",
    color: "#ec4899",
    bg: "#fdf2f8",
    items: ["운동회", "물놀이", "할로윈", "크리스마스", "가족참여수업", "아빠참여수업"],
    subs: ["운동회", "물놀이", "할로윈", "크리스마스", "가족참여", "아빠참여"],
    icon: "party",
    resourceCount: 56,
  },
  {
    id: "child-dev",
    num: 6,
    title: "아동 발달 자료",
    color: "#f97316",
    bg: "#fff7ed",
    items: ["연령별 발달", "사회성 발달", "신체 발달", "운동 발달"],
    subs: ["연령별", "사회성", "신체", "운동"],
    icon: "smile",
    resourceCount: 32,
  },
  {
    id: "teacher-ed",
    num: 7,
    title: "교사 교육 자료",
    color: "#14b8a6",
    bg: "#f0fdfa",
    items: ["신입교사 교육", "안전 교육", "수업 운영", "교구 교육", "기관 안내"],
    subs: ["신입교사", "안전", "수업운영", "교구", "기관"],
    icon: "grad",
    resourceCount: 48,
  },
  {
    id: "videos",
    num: 8,
    title: "영상 자료실",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    items: ["수업 영상", "교구 활용 영상", "행사 영상", "영어체육 영상", "교육 콘텐츠"],
    subs: ["수업", "교구", "행사", "영어체육", "교육"],
    icon: "video",
    resourceCount: 96,
  },
];

const ALLOWED_FILE_ACCEPT = [
  ".pdf",
  ".doc,.docx",
  ".xls,.xlsx",
  ".hwp,.hwpx",
  ".mp3,.wav,.m4a",
  "image/*",
  "video/*",
].join(",");

const ALLOWED_FILE_HINT =
  "PDF · Word(.doc, .docx) · 엑셀(.xlsx, .xls) · 한글(.hwp, .hwpx) · 이미지 · 영상 · 음원(.mp3, .wav, .m4a)";

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
  if (t === "pdf") return "PDF";
  if (t === "video") return "영상";
  if (t === "image") return "이미지";
  if (t === "word") return "Word";
  if (t === "excel") return "엑셀";
  if (t === "hwp") return "한글";
  if (t === "audio") return "음원";
  return "파일";
}

async function fetchResources() {
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("resources fetch:", error.message);
    return [];
  }
  return data || [];
}

const CATEGORY_ICONS = {
  users: Users,
  ball: Trophy,
  abc: Languages,
  clipboard: ClipboardList,
  party: PartyPopper,
  smile: Baby,
  grad: GraduationCap,
  video: Video,
};

function CategoryIcon({ type, color }) {
  const Icon = CATEGORY_ICONS[type] || ClipboardList;
  return <Icon size={22} strokeWidth={1.75} color={color} aria-hidden />;
}

function GtsPlatformLogo() {
  return (
    <span className="pe-res-platform-title">
      <span className="pe-res-platform-gts">GTS</span>
      <span className="pe-res-platform-label"> 통합 플랫폼</span>
    </span>
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
        category_id: category.id,
        subcategory: subcategory || null,
        title: title.trim(),
        description: description.trim(),
        tags: tagList,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: detectFileType(file),
        file_size: file.size,
        author_id: me.id,
        author_name: me.name,
      });
      if (insErr) throw new Error(insErr.message);
      alert("자료가 업로드되었습니다.");
      onSaved();
      onClose();
    } catch (e) {
      alert("업로드 오류: " + (e.message || "알 수 없는 오류"));
    }
    setSaving(false);
  };

  return (
    <div className="pe-res-overlay" onClick={onClose}>
      <div className="pe-res-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>자료 업로드</h2>
          <button type="button" onClick={onClose} className="pe-res-modal-close" aria-label="닫기">
            <X size={18}/>
          </button>
        </div>
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
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55, marginBottom: 8 }}>
          허용 형식: {ALLOWED_FILE_HINT}
        </div>
        <input ref={fileRef} type="file" accept={ALLOWED_FILE_ACCEPT} onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...peInp, padding: 10 }}/>
        {file && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>{file.name} ({Math.round(file.size / 1024)} KB)</div>}
        <button type="button" onClick={submit} disabled={saving} style={{ ...pePrimaryBtn, width: "100%" }}>
          {saving ? "업로드 중..." : "업로드"}
        </button>
      </div>
    </div>
  );
}

const peLbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 };
const peInp = {
  width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
  fontSize: 14, marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box",
};
const pePrimaryBtn = {
  padding: "13px 20px", borderRadius: 10, border: "none", background: "#22c55e",
  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  flexShrink: 0,
};

function ResourceListPage({ category, search, subFilter, me, resources, loading, onRefresh }) {
  const [showUpload, setShowUpload] = useState(false);
  const [localSub, setLocalSub] = useState(subFilter || "ALL");
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

  return (
    <div className="pe-res-list-page">
      <div className="pe-res-list-header">
        <div className="pe-res-list-title-wrap">
          <h1 className="pe-res-list-title">{pageTitle}</h1>
          {search && <p className="pe-res-list-search-note">검색: &quot;{search}&quot;</p>}
        </div>
        {admin && category && (
          <button type="button" onClick={() => setShowUpload(true)} className="pe-res-upload-btn">
            <Upload size={16} strokeWidth={2.5}/>
            자료 업로드
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
        <div className="pe-res-empty pe-res-empty-box">
          등록된 자료가 없습니다
        </div>
      ) : (
        <div className="pe-res-resource-list">
          {filtered.map(res => (
            <div key={res.id} className="pe-res-resource-item">
              <div className="pe-res-resource-type" style={{ background: `${accent}18`, color: accent }}>
                {fileTypeLabel(res.file_type)}
              </div>
              <div className="pe-res-resource-body">
                <div className="pe-res-resource-title">{res.title}</div>
                {res.description && (
                  <div className="pe-res-resource-desc">{res.description}</div>
                )}
                <div className="pe-res-resource-meta">
                  {res.subcategory && (
                    <span className="pe-res-meta-tag">{res.subcategory}</span>
                  )}
                  {(res.tags || []).map(t => (
                    <span key={t} className="pe-res-meta-tag pe-res-meta-tag-accent" style={{ background: `${accent}14`, color: accent }}>{t}</span>
                  ))}
                  <span className="pe-res-meta-date">
                    {res.author_name || ""} · {res.created_at ? new Date(res.created_at).toLocaleDateString("ko-KR") : ""}
                  </span>
                </div>
              </div>
              {res.file_url && (
                <a
                  href={res.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={res.file_name || undefined}
                  className="pe-res-download-btn"
                  style={{ background: accent }}
                >
                  <Download size={15} strokeWidth={2.5}/>
                  다운로드
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showUpload && category && (
        <ResourceUploadModal
          category={category}
          me={me}
          onClose={() => setShowUpload(false)}
          onSaved={onRefresh}
        />
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

function CategoryCard({ cat, onGo }) {
  return (
    <div
      className="pe-res-card"
      style={{ "--card-accent": cat.color, "--card-bg": cat.bg }}
      onClick={() => onGo(cat)}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onGo(cat)}
    >
      <div className="pe-res-card-stats">
        <span>{cat.subs.length}개 카테고리</span>
        <span>총 {cat.resourceCount}개 자료</span>
      </div>
      <div className="pe-res-card-head">
        <div className="pe-res-card-icon">
          <CategoryIcon type={cat.icon} color={cat.color}/>
        </div>
        <div className="pe-res-card-title">
          <span className="pe-res-card-num" style={{ color: cat.color }}>{cat.num}.</span>
          {cat.title}
        </div>
      </div>
      <ul className="pe-res-card-items">
        {cat.items.map(it => (
          <li key={it} className="pe-res-card-item">{it}</li>
        ))}
      </ul>
    </div>
  );
}

function HubView({ search, setSearch, onSearch, onTag, onGoCategory }) {
  return (
    <>
      <div className="pe-res-hero">
        <div className="pe-res-hero-intro">
          <h1 className="pe-res-page-title">체육자료실</h1>
          <p className="pe-res-page-desc">
            수업 준비에 필요한 모든 자료를 빠르게 검색하고 활용하세요.
          </p>
        </div>
        <div className="pe-res-search-section">
          <div className="pe-res-search">
            <Search size={18} strokeWidth={2} color="#94a3b8"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onSearch()}
              placeholder="검색어를 입력하세요. (예. 4세 균형, 축구, 영어체육, 점프활동)"
            />
          </div>
          <div className="pe-res-quick-tags">
            {QUICK_TAGS.map(tag => (
              <button key={tag} type="button" onClick={() => onTag(tag)} className="pe-res-quick-tag">{tag}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="pe-res-grid">
        {PE_CATEGORIES.map(cat => (
          <CategoryCard key={cat.id} cat={cat} onGo={onGoCategory}/>
        ))}
      </div>
    </>
  );
}

export default function PeResourcesApp({ me, onBack }) {
  const [view, setView] = useState("hub");
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadResources = async () => {
    setLoading(true);
    const data = await fetchResources();
    setResources(data);
    setLoading(false);
  };

  useEffect(() => { loadResources(); }, []);

  const goCategory = (cat) => {
    setCategory(cat);
    setListSearch("");
    setView("list");
  };

  const goSearch = (q) => {
    setCategory(null);
    setListSearch(q);
    setView("list");
  };

  const roleLabel = me?.role === "superadmin" ? "슈퍼관리자" : me?.role === "admin" ? "관리자" : "선생님";

  const goHub = () => {
    setView("hub");
    setCategory(null);
  };

  return (
    <div className="pe-resources-app">
      <header className="pe-res-header">
        <div className="pe-res-header-left">
          {view === "list" ? (
            <button type="button" className="pe-res-back-btn pe-res-back-btn-header" onClick={goHub}>
              <ChevronLeft size={18} strokeWidth={2.5}/>
              체육자료실
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
            search={search}
            setSearch={setSearch}
            onSearch={() => goSearch(search)}
            onTag={goSearch}
            onGoCategory={goCategory}
          />
        ) : (
          <ResourceListPage
            category={category}
            search={listSearch}
            me={me}
            resources={resources}
            loading={loading}
            onRefresh={loadResources}
          />
        )}
      </main>

      <footer className="pe-res-footer">© 2026 GTS. All rights reserved.</footer>
    </div>
  );
}
