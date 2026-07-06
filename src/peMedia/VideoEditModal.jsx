import { useState } from "react";
import { X } from "lucide-react";
import { updateMediaResource } from "./peMediaApi.js";

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

export default function VideoEditModal({ resource, onClose, onSaved }) {
  const [title, setTitle] = useState(resource.title || "");
  const [description, setDescription] = useState(resource.description || "");
  const [tags, setTags] = useState((resource.tags || []).join(", "));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return alert("제목을 입력하세요");
    setSaving(true);
    try {
      await updateMediaResource(resource.id, {
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean),
      });
      onSaved();
      onClose();
    } catch (e) {
      alert("수정 오류: " + e.message);
    }
    setSaving(false);
  };

  return (
    <ModalShell title="영상 수정" onClose={onClose}>
      <label style={peLbl}>제목 *</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={peInp}/>
      <label style={peLbl}>설명</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...peInp, minHeight: 80, resize: "vertical" }}/>
      <label style={peLbl}>태그</label>
      <input value={tags} onChange={e => setTags(e.target.value)} style={peInp}/>
      <button type="button" onClick={submit} disabled={saving} style={{ ...pePrimaryBtn, width: "100%" }}>
        {saving ? "저장 중..." : "저장"}
      </button>
    </ModalShell>
  );
}
