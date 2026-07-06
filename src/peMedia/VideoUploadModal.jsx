import { useMemo, useState } from "react";
import { Upload, X } from "lucide-react";
import {
  buildYoutubeWatchUrl,
  detectVideoFile,
  getYoutubeThumbnail,
  parseYoutubeVideoId,
} from "./peMediaUtils.js";
import { insertMediaResource, uploadPeFile } from "./peMediaApi.js";

const peLbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 };
const peInp = {
  width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
  fontSize: 14, marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box",
};
const pePrimaryBtn = {
  padding: "13px 20px", borderRadius: 10, border: "none", background: "#0ea5e9",
  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};

function ModalShell({ title, onClose, children }) {
  return (
    <div className="pe-res-overlay" onClick={onClose}>
      <div className="pe-res-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>{title}</h2>
          <button type="button" onClick={onClose} className="pe-res-modal-close" aria-label="닫기"><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function VideoUploadModal({ me, onClose, onSaved }) {
  const [mode, setMode] = useState("youtube");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const youtubeVideoId = useMemo(() => parseYoutubeVideoId(youtubeUrl), [youtubeUrl]);

  const submit = async () => {
    if (!title.trim()) return alert("제목을 입력하세요");
    setSaving(true);
    try {
      const tagList = tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
      let payload;
      if (mode === "file") {
        if (!file || !detectVideoFile(file)) return alert("영상 파일을 선택하세요");
        const ext = file.name.split(".").pop() || "mp4";
        const path = `videos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const fileUrl = await uploadPeFile(path, file);
        payload = {
          category_id: "videos",
          title: title.trim(),
          description: description.trim(),
          tags: tagList,
          file_url: fileUrl,
          file_name: file.name,
          file_type: "video",
          file_size: file.size,
          author_id: me.id,
          author_name: me.name,
        };
      } else {
        if (!youtubeVideoId) return alert("유효한 유튜브 링크를 입력하세요");
        payload = {
          category_id: "videos",
          title: title.trim(),
          description: description.trim(),
          tags: tagList,
          file_url: buildYoutubeWatchUrl(youtubeVideoId),
          file_name: `${youtubeVideoId}.youtube`,
          file_type: "youtube",
          author_id: me.id,
          author_name: me.name,
        };
      }
      await insertMediaResource(payload);
      onSaved();
      onClose();
    } catch (e) {
      alert("업로드 오류: " + e.message);
    }
    setSaving(false);
  };

  return (
    <ModalShell title="영상 업로드" onClose={onClose}>
      <div className="pe-res-upload-mode-toggle" role="tablist">
        <button type="button" className={`pe-res-upload-mode-btn${mode === "youtube" ? " active" : ""}`} onClick={() => setMode("youtube")}>유튜브 링크</button>
        <button type="button" className={`pe-res-upload-mode-btn${mode === "file" ? " active" : ""}`} onClick={() => setMode("file")}><Upload size={15}/> 영상 파일</button>
      </div>
      <label style={peLbl}>제목 *</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={peInp}/>
      <label style={peLbl}>설명</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...peInp, minHeight: 70, resize: "vertical" }}/>
      <label style={peLbl}>태그</label>
      <input value={tags} onChange={e => setTags(e.target.value)} style={peInp} placeholder="쉼표로 구분"/>
      {mode === "file" ? (
        <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...peInp, padding: 10 }}/>
      ) : (
        <>
          <label style={peLbl}>유튜브 링크 *</label>
          <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} style={peInp} placeholder="https://www.youtube.com/watch?v=..."/>
          {youtubeVideoId ? (
            <img src={getYoutubeThumbnail(youtubeVideoId)} alt="" className="pe-res-youtube-preview-img" style={{ width: "100%", borderRadius: 10, marginBottom: 12 }}/>
          ) : null}
        </>
      )}
      <button type="button" onClick={submit} disabled={saving} style={{ ...pePrimaryBtn, width: "100%" }}>
        {saving ? "저장 중..." : "등록"}
      </button>
    </ModalShell>
  );
}
