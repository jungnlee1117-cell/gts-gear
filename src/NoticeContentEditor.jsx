import { useEffect, useRef, useState } from "react";
import { FileText, Image, Paperclip, Trash2, Upload } from "lucide-react";
import {
  NOTICE_ATTACHMENT_ACCEPT,
  createNoticeAttachmentUrls,
  formatAttachmentSize,
  isNoticeImage,
  validateNoticeFiles,
} from "./noticeAttachments.js";

const TEMPLATES = [
  {
    label: "일반 안내",
    title: "",
    body: "안녕하세요, GTS입니다.\n\n■ 안내 내용\n- \n\n■ 확인 사항\n- \n\n감사합니다.",
  },
  {
    label: "준비물 안내",
    title: "수업 준비물 안내",
    body: "안녕하세요, GTS입니다.\n\n■ 준비물\n- \n\n■ 준비 날짜\n- \n\n■ 참고 사항\n- \n\n감사합니다.",
  },
  {
    label: "일정 변경",
    title: "수업 일정 변경 안내",
    body: "안녕하세요, GTS입니다.\n\n■ 변경 전\n- \n\n■ 변경 후\n- \n\n■ 변경 사유\n- \n\n일정을 확인해 주세요. 감사합니다.",
  },
  {
    label: "교육·회의",
    title: "선생님 교육 및 회의 안내",
    body: "안녕하세요, GTS입니다.\n\n■ 일시\n- \n\n■ 장소\n- \n\n■ 주요 내용\n- \n\n■ 준비 사항\n- \n\n참석 여부를 확인해 주세요.",
  },
];

function InlineText({ text }) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : <span key={index}>{part}</span>);
}

export function NoticeBodyDisplay({ body }) {
  const lines = String(body || "").split("\n");
  return (
    <div className="notice-rich-body">
      {lines.map((line, index) => {
        const value = line.trimEnd();
        if (!value) return <div key={index} className="notice-rich-body__space"/>;
        if (/^#{1,3}\s/.test(value)) return <h3 key={index}>{value.replace(/^#{1,3}\s*/, "")}</h3>;
        if (/^[■●]\s*/.test(value)) return <h4 key={index}>{value.replace(/^[■●]\s*/, "")}</h4>;
        if (/^[-•]\s+/.test(value)) return <div key={index} className="notice-rich-body__bullet"><span>•</span><p><InlineText text={value.replace(/^[-•]\s+/, "")}/></p></div>;
        return <p key={index}><InlineText text={value}/></p>;
      })}
    </div>
  );
}

export function NoticeContentEditor({ title, setTitle, body, setBody }) {
  const textareaRef = useRef(null);

  const applyTemplate = template => {
    if ((title.trim() || body.trim()) && !confirm("현재 작성 중인 내용을 선택한 양식으로 바꿀까요?")) return;
    if (template.title) setTitle(template.title);
    setBody(template.body);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const insertText = (before, after = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  };

  return (
    <div className="notice-composer">
      <section className="notice-template-picker">
        <div className="notice-form-label">자주 쓰는 양식 <span>선택사항</span></div>
        <div className="notice-template-picker__buttons">
          {TEMPLATES.map(template => (
            <button key={template.label} type="button" onClick={() => applyTemplate(template)}>{template.label}</button>
          ))}
        </div>
      </section>

      <label className="notice-composer__field">
        <span className="notice-form-label">제목 *</span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 9월 수업 준비물 안내" maxLength={100}/>
        <small>{title.length}/100</small>
      </label>

      <div className="notice-composer__field">
        <span className="notice-form-label">내용</span>
        <div className="notice-editor-toolbar" aria-label="글 서식">
          <button type="button" onClick={() => insertText("■ ")} title="소제목">소제목</button>
          <button type="button" onClick={() => insertText("- ")} title="글머리표">• 목록</button>
          <button type="button" onClick={() => insertText("**", "**")} title="강조"><strong>굵게</strong></button>
        </div>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={"선생님에게 전달할 내용을 적어주세요.\n\n■ 꼭 확인할 내용\n- "}
          rows={10}
        />
        <small>소제목과 목록을 활용하면 휴대폰에서도 읽기 쉽습니다.</small>
      </div>

      {(title.trim() || body.trim()) ? (
        <details className="notice-preview">
          <summary>선생님에게 보이는 모습 미리보기</summary>
          <div className="notice-preview__paper">
            <h3>{title.trim() || "공지 제목"}</h3>
            <NoticeBodyDisplay body={body}/>
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function NoticeAttachmentsField({
  supabase,
  existing = [],
  onExistingChange,
  files = [],
  onFilesChange,
}) {
  const inputRef = useRef(null);
  const [existingWithUrls, setExistingWithUrls] = useState([]);
  const [localUrls, setLocalUrls] = useState([]);

  useEffect(() => {
    let cancelled = false;
    createNoticeAttachmentUrls(supabase, existing).then(rows => {
      if (!cancelled) setExistingWithUrls(rows);
    });
    return () => { cancelled = true; };
  }, [supabase, existing]);

  useEffect(() => {
    const rows = files.map(file => ({ file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "" }));
    setLocalUrls(rows);
    return () => rows.forEach(row => row.url && URL.revokeObjectURL(row.url));
  }, [files]);

  const addFiles = event => {
    const incoming = Array.from(event.target.files || []);
    const error = validateNoticeFiles(incoming, existing.length + files.length);
    event.target.value = "";
    if (error) return alert(error);
    onFilesChange([...files, ...incoming]);
  };

  const removeExisting = id => onExistingChange(existing.filter(item => item.id !== id));
  const removeLocal = index => onFilesChange(files.filter((_, i) => i !== index));

  return (
    <section className="notice-attachments-field">
      <div className="notice-attachments-field__head">
        <div>
          <span className="notice-form-label">파일·이미지 첨부 <span>선택사항</span></span>
          <p>이미지, PDF, 한글·워드·엑셀·PPT 파일 · 개당 15MB 이하 · 최대 10개</p>
        </div>
        <button type="button" className="notice-attach-button" onClick={() => inputRef.current?.click()}>
          <Upload size={16}/> 파일 선택
        </button>
        <input ref={inputRef} type="file" multiple hidden accept={NOTICE_ATTACHMENT_ACCEPT} onChange={addFiles}/>
      </div>

      {!existing.length && !files.length ? (
        <button type="button" className="notice-attachment-drop" onClick={() => inputRef.current?.click()}>
          <Paperclip size={20}/><span>사진이나 파일을 첨부하려면 눌러주세요</span>
        </button>
      ) : (
        <div className="notice-attachment-list">
          {existingWithUrls.map(item => (
            <div key={item.id} className="notice-attachment-item">
              {isNoticeImage(item) && item.url ? <img src={item.url} alt=""/> : <FileText size={22}/>} 
              <div><strong>{item.name}</strong><small>{formatAttachmentSize(item.size)} · 등록됨</small></div>
              <button type="button" onClick={() => removeExisting(item.id)} aria-label={`${item.name} 삭제`}><Trash2 size={15}/></button>
            </div>
          ))}
          {localUrls.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="notice-attachment-item is-new">
              {item.url ? <img src={item.url} alt=""/> : item.file.type.startsWith("image/") ? <Image size={22}/> : <FileText size={22}/>} 
              <div><strong>{item.file.name}</strong><small>{formatAttachmentSize(item.file.size)} · 저장 대기</small></div>
              <button type="button" onClick={() => removeLocal(index)} aria-label={`${item.file.name} 삭제`}><Trash2 size={15}/></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function NoticeAttachmentsDisplay({ supabase, attachments = [] }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let cancelled = false;
    createNoticeAttachmentUrls(supabase, attachments).then(result => !cancelled && setRows(result));
    return () => { cancelled = true; };
  }, [supabase, attachments]);
  if (!attachments.length) return null;
  return (
    <section className="notice-detail-attachments">
      <h4>첨부파일 {attachments.length}개</h4>
      <div className="notice-detail-attachments__grid">
        {rows.map(item => isNoticeImage(item) ? (
          <a key={item.id} href={item.url || undefined} target="_blank" rel="noreferrer" className="notice-detail-image">
            {item.url ? <img src={item.url} alt={item.name}/> : <Image size={22}/>}<span>{item.name}</span>
          </a>
        ) : (
          <a key={item.id} href={item.url || undefined} target="_blank" rel="noreferrer" download={item.name} className="notice-detail-file">
            <FileText size={20}/><span><strong>{item.name}</strong><small>{formatAttachmentSize(item.size)}</small></span>
          </a>
        ))}
      </div>
    </section>
  );
}
