import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

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
  },
];

function detectFileType(file) {
  if (!file) return "other";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  return "other";
}

function fileTypeLabel(t) {
  if (t === "pdf") return "PDF";
  if (t === "video") return "영상";
  if (t === "image") return "이미지";
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

function CategoryIcon({ type, color }) {
  const s = { width: 22, height: 22, stroke: color, fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "users") return <svg {...s} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === "ball") return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
  if (type === "abc") return <svg {...s} viewBox="0 0 24 24"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>;
  if (type === "clipboard") return <svg {...s} viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
  if (type === "party") return <svg {...s} viewBox="0 0 24 24"><path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M4 10a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>;
  if (type === "smile") return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
  if (type === "grad") return <svg {...s} viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
  if (type === "video") return <svg {...s} viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
  return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
}

function GtsPlatformLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden>
        <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="#22c55e"/>
        <text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800" fontFamily="sans-serif">G</text>
      </svg>
      <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.02em" }}>
        <span style={{ color: "#22c55e" }}>GTS</span>
        <span style={{ color: "#111827" }}> 통합 플랫폼</span>
      </span>
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
          <button type="button" onClick={onClose} style={peIconBtn}>✕</button>
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
        <label style={peLbl}>파일 * (PDF, 영상, 이미지)</label>
        <input ref={fileRef} type="file" accept=".pdf,image/*,video/*" onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...peInp, padding: 10 }}/>
        {file && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>{file.name} ({Math.round(file.size / 1024)} KB)</div>}
        <button type="button" onClick={submit} disabled={saving} style={pePrimaryBtn}>
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
  width: "100%", padding: "13px", borderRadius: 10, border: "none", background: "#22c55e",
  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};
const peIconBtn = {
  border: "none", background: "#f1f5f9", borderRadius: 8, width: 36, height: 36,
  cursor: "pointer", fontSize: 16, fontFamily: "inherit",
};

function ResourceListPage({ category, search, subFilter, me, resources, loading, onBack, onRefresh }) {
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
    <div>
      <button type="button" onClick={onBack} style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
        padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#334155",
        cursor: "pointer", marginBottom: 24, fontFamily: "inherit",
      }}>
        ← 체육자료실
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, color: "#111827" }}>{pageTitle}</h1>
          {search && <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>검색: &quot;{search}&quot;</p>}
        </div>
        {admin && category && (
          <button type="button" onClick={() => setShowUpload(true)} style={{ ...pePrimaryBtn, width: "auto", padding: "11px 20px" }}>
            + 자료 업로드
          </button>
        )}
      </div>

      {category?.subs?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <button type="button" onClick={() => setLocalSub("ALL")} style={peTagBtn(localSub === "ALL", accent)}>전체</button>
          {category.subs.map(s => (
            <button key={s} type="button" onClick={() => setLocalSub(s)} style={peTagBtn(localSub === s, accent)}>{s}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 16,
          border: "1px solid #e8ecee", color: "#94a3b8", fontSize: 14,
        }}>
          등록된 자료가 없습니다
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(res => (
            <div key={res.id} style={{
              background: "#fff", borderRadius: 14, border: "1px solid #e8ecee",
              padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: `${accent}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: accent, flexShrink: 0,
              }}>
                {fileTypeLabel(res.file_type)}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#111827", marginBottom: 4 }}>{res.title}</div>
                {res.description && (
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 8 }}>{res.description}</div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {res.subcategory && (
                    <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 99, color: "#64748b" }}>{res.subcategory}</span>
                  )}
                  {(res.tags || []).map(t => (
                    <span key={t} style={{ fontSize: 11, background: `${accent}14`, padding: "2px 8px", borderRadius: 99, color: accent }}>{t}</span>
                  ))}
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
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
                  style={{
                    padding: "10px 18px", borderRadius: 10, background: accent, color: "#fff",
                    fontSize: 13, fontWeight: 700, textDecoration: "none", flexShrink: 0,
                  }}
                >
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
  const half = Math.ceil(cat.items.length / 2);
  const col1 = cat.items.slice(0, half);
  const col2 = cat.items.slice(half);

  return (
    <div className="pe-res-card" onClick={() => onGo(cat)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onGo(cat)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: cat.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CategoryIcon type={cat.icon} color={cat.color}/>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
          <span style={{ color: cat.color, marginRight: 6 }}>{cat.num}.</span>
          {cat.title}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 18, flex: 1 }}>
        <div>{col1.map(it => <div key={it} style={{ fontSize: 12, color: "#64748b", marginBottom: 5 }}>· {it}</div>)}</div>
        <div>{col2.map(it => <div key={it} style={{ fontSize: 12, color: "#64748b", marginBottom: 5 }}>· {it}</div>)}</div>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onGo(cat); }}
        style={{
          background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 700,
          color: cat.color, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}
      >
        바로가기 →
      </button>
    </div>
  );
}

function HubView({ search, setSearch, onSearch, onTag, onGoCategory }) {
  return (
    <>
      <div className="pe-res-hero">
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900, color: "#111827", letterSpacing: "-0.03em" }}>
            체육자료실
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            수업 준비에 필요한 모든 자료를 빠르게 검색하고 활용하세요.
          </p>
        </div>
        <div className="pe-res-search-wrap">
          <div className="pe-res-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onSearch()}
              placeholder="검색어를 입력하세요. (예. 4세 균형, 축구, 영어체육, 점프활동)"
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
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

  return (
    <div className="pe-resources-app">
      <header className="pe-res-header">
        <GtsPlatformLogo/>
        <nav className="pe-res-nav">
          <button type="button" className="pe-res-nav-item" onClick={onBack}>교구 관리</button>
          <button type="button" className="pe-res-nav-item pe-res-nav-active">체육 프로그램</button>
          <button type="button" className="pe-res-nav-item pe-res-nav-disabled">수업 운영</button>
          <button type="button" className="pe-res-nav-item pe-res-nav-disabled">자료실</button>
        </nav>
        <div className="pe-res-user">
          <span style={{ fontSize: 13, color: "#64748b" }}>안녕하세요, <strong style={{ color: "#111827" }}>{me?.name}님</strong>!</span>
          <button type="button" className="pe-res-profile-btn">{roleLabel} ▾</button>
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
            onBack={() => { setView("hub"); setCategory(null); }}
            onRefresh={loadResources}
          />
        )}
      </main>

      <footer className="pe-res-footer">© 2026 GTS. All rights reserved.</footer>
    </div>
  );
}
