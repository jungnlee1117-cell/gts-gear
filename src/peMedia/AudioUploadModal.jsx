import { useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { detectAudioFile } from "./peMediaUtils.js";
import { insertMediaResource, uploadPeFile } from "./peMediaApi.js";

const peLbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 };
const peInp = {
  width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
  fontSize: 14, marginBottom: 0, fontFamily: "inherit", boxSizing: "border-box",
};
const pePrimaryBtn = {
  padding: "13px 20px", borderRadius: 10, border: "none", background: "#22c55e",
  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};

function defaultTitleFromFileName(name) {
  const base = String(name || "").replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").trim() || "제목 없음";
}

function parseTags(text) {
  return String(text || "").split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
}

function makeQueueItem(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    title: defaultTitleFromFileName(file.name),
    tags: "",
    status: "pending",
    error: "",
  };
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

export default function AudioUploadModal({ me, onClose, onSaved }) {
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);

  const pendingItems = useMemo(
    () => items.filter(i => i.status === "pending" || i.status === "error"),
    [items],
  );
  const doneCount = useMemo(() => items.filter(i => i.status === "done").length, [items]);
  const totalCount = items.length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  const handleFilesSelected = (fileList) => {
    const files = [...(fileList || [])].filter(detectAudioFile);
    if (!files.length) {
      alert("MP3 또는 WAV 파일을 선택해 주세요.");
      return;
    }
    setItems(prev => {
      const existingKeys = new Set(prev.map(i => `${i.file.name}|${i.file.size}|${i.file.lastModified}`));
      const next = [...prev];
      for (const file of files) {
        const key = `${file.name}|${file.size}|${file.lastModified}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        next.push(makeQueueItem(file));
      }
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateItem = (id, patch) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id) => {
    if (uploading) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const uploadOne = async (item) => {
    const tagList = parseTags(item.tags);
    const ext = item.file.name.split(".").pop() || "mp3";
    const audioPath = `audio/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const fileUrl = await uploadPeFile(audioPath, item.file);
    await insertMediaResource({
      category_id: "audio",
      title: item.title.trim(),
      description: "",
      tags: tagList,
      file_url: fileUrl,
      file_name: item.file.name,
      file_type: "audio",
      file_size: item.file.size,
      cover_url: null,
      author_id: me.id,
      author_name: me.name,
    });
  };

  const submitAll = async () => {
    const toUpload = items.filter(i => i.status === "pending" || i.status === "error");
    if (!toUpload.length) return alert("업로드할 파일을 선택해 주세요.");

    const missingTitle = toUpload.find(i => !i.title.trim());
    if (missingTitle) return alert(`"${missingTitle.file.name}"의 곡 제목을 입력해 주세요.`);

    setUploading(true);
    let completed = items.filter(i => i.status === "done").length;
    let errorCount = 0;

    for (let i = 0; i < toUpload.length; i += 1) {
      const item = toUpload[i];
      setUploadIndex(completed + 1);
      updateItem(item.id, { status: "uploading", error: "" });
      try {
        await uploadOne(item);
        completed += 1;
        setUploadIndex(completed);
        updateItem(item.id, { status: "done", error: "" });
      } catch (e) {
        errorCount += 1;
        updateItem(item.id, { status: "error", error: e.message || "업로드 실패" });
      }
    }

    setUploading(false);
    onSaved();

    if (errorCount === 0 && completed === totalCount) {
      onClose();
    }
  };

  const progressLabel = uploading
    ? `${Math.min(uploadIndex, totalCount)}/${totalCount} 업로드 중...`
    : allDone
      ? `${doneCount}/${totalCount} 업로드 완료`
      : totalCount > 0
        ? `${doneCount}/${totalCount} 완료 · ${pendingItems.length}개 대기`
        : null;

  const handleClose = () => {
    if (uploading) return;
    onClose();
  };

  return (
    <ModalShell title="음원 업로드" onClose={handleClose} wide>
      <label style={peLbl}>음원 파일 (MP3/WAV) — 여러 개 선택 가능</label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        multiple
        disabled={uploading}
        onChange={e => handleFilesSelected(e.target.files)}
        style={{ ...peInp, marginBottom: 14, padding: 10 }}
      />

      {items.length > 0 ? (
        <>
          {progressLabel ? (
            <p className="pe-audio-upload-progress" aria-live="polite">{progressLabel}</p>
          ) : null}
          <ul className="pe-audio-upload-queue">
            {items.map((item, idx) => (
              <li
                key={item.id}
                className={[
                  "pe-audio-upload-item",
                  item.status === "done" && "pe-audio-upload-item--done",
                  item.status === "uploading" && "pe-audio-upload-item--uploading",
                  item.status === "error" && "pe-audio-upload-item--error",
                ].filter(Boolean).join(" ")}
              >
                <div className="pe-audio-upload-item-head">
                  <span className="pe-audio-upload-item-num">{idx + 1}</span>
                  <span className="pe-audio-upload-item-filename" title={item.file.name}>{item.file.name}</span>
                  {item.status === "done" ? (
                    <span className="pe-audio-upload-check" aria-label="업로드 완료"><Check size={18}/></span>
                  ) : !uploading ? (
                    <button type="button" className="pe-audio-upload-remove" onClick={() => removeItem(item.id)} aria-label="목록에서 제거">
                      <X size={16}/>
                    </button>
                  ) : null}
                </div>
                {item.status !== "done" ? (
                  <div className="pe-audio-upload-fields">
                    <label className="pe-audio-upload-field">
                      <span>곡 제목 *</span>
                      <input
                        value={item.title}
                        disabled={uploading || item.status === "uploading"}
                        onChange={e => updateItem(item.id, { title: e.target.value })}
                        style={peInp}
                      />
                    </label>
                    <label className="pe-audio-upload-field">
                      <span>태그</span>
                      <input
                        value={item.tags}
                        disabled={uploading || item.status === "uploading"}
                        onChange={e => updateItem(item.id, { tags: e.target.value })}
                        style={peInp}
                        placeholder="쉼표로 구분"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="pe-audio-upload-done-meta">{item.title}{item.tags ? ` · ${item.tags}` : ""}</p>
                )}
                {item.status === "error" && item.error ? (
                  <p className="pe-audio-upload-error">{item.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="pe-muted pe-audio-upload-hint">파일을 선택하면 곡별로 제목과 태그를 입력할 수 있습니다.</p>
      )}

      <button
        type="button"
        onClick={submitAll}
        disabled={uploading || pendingItems.length === 0}
        style={{ ...pePrimaryBtn, width: "100%", marginTop: 16, opacity: uploading || pendingItems.length === 0 ? 0.6 : 1 }}
      >
        {uploading ? progressLabel : `전체 업로드 (${pendingItems.length || totalCount}곡)`}
      </button>
    </ModalShell>
  );
}
