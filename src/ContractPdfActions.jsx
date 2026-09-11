import { useState } from "react";

// Blob URLs keep saving and printing on the current origin, including private PDFs.
export default function ContractPdfActions({ url, filename = "GTS_계약서.pdf" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename.replace(/[\\/:*?"<>|]/g, "_");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch { setError("PDF를 저장하지 못했습니다. 계약서를 다시 열어 주세요."); }
    finally { setBusy(false); }
  };
  const print = () => {
    // Open synchronously so mobile browsers do not block the user's action.
    const popup = window.open("", "_blank");
    if (!popup) { setError("인쇄 창을 열 수 없습니다. 새 탭 열기를 눌러 주세요."); return; }
    popup.opener = null;
    const title = popup.document.createElement("title"); title.textContent = "GTS 계약서 인쇄";
    popup.document.head.appendChild(title);
    const controls = popup.document.createElement("div");
    controls.style.cssText = "padding:12px;font:14px sans-serif;display:flex;gap:14px;align-items:center;flex-wrap:wrap";
    const btn = popup.document.createElement("button"); btn.textContent = "인쇄";
    btn.style.cssText = "padding:10px 24px;background:#14503c;color:white;border:0;border-radius:8px;cursor:pointer";
    const hint = popup.document.createElement("span"); hint.textContent = "PDF가 표시되면 인쇄를 누르세요. 모바일에서는 PDF의 공유 메뉴에서 인쇄할 수 있습니다.";
    const frame = popup.document.createElement("iframe");
    frame.title = "인쇄할 계약서";
    frame.src = url;
    frame.style.cssText = "width:100%;height:calc(100vh - 90px);border:0";
    const direct = popup.document.createElement("a"); direct.textContent = "PDF 직접 열기"; direct.href = url;
    btn.onclick = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch { popup.location.href = url; }
    };
    controls.append(btn, hint, direct);
    popup.document.body.style.margin = "0";
    popup.document.body.append(controls, frame);
  };
  return <>
    <button type="button" className="my-profile-btn-ghost" onClick={save} disabled={busy}>{busy ? "저장 중..." : "PDF 저장"}</button>
    <button type="button" className="my-profile-btn-ghost" onClick={print}>인쇄</button>
    <a className="my-profile-btn-ghost" href={url} target="_blank" rel="noreferrer">새 탭 열기</a>
    {error && <span role="alert" className="my-profile-field-error">{error}</span>}
  </>;
}
