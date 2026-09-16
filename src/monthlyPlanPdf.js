function waitForFrameLoad(frame) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("계획안 화면을 불러오는 데 시간이 오래 걸립니다.")), 15000);
    frame.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function inlineFrameImages(frameDocument) {
  await Promise.all([...frameDocument.images].map(async (image) => {
    try {
      const response = await fetch(image.currentSrc || image.src);
      if (!response.ok) return;
      image.src = await blobToDataUrl(await response.blob());
      await image.decode().catch(() => null);
    } catch {
      // CORS로 변환할 수 없는 이미지는 html2canvas의 useCORS 처리에 맡긴다.
    }
  }));
}

/**
 * 월간계획안 인쇄 화면과 동일한 HTML을 PDF Blob으로 변환한다.
 * 이 Blob 하나를 로컬 다운로드와 자료실 업로드에 함께 사용한다.
 */
export async function buildMonthlyPlanPdfBlob(printableHtml) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;pointer-events:none;";
  document.body.appendChild(frame);

  try {
    const loaded = waitForFrameLoad(frame);
    frame.srcdoc = String(printableHtml || "");
    await loaded;

    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error("계획안 화면을 만들지 못했습니다.");
    frame.contentWindow?.scrollTo(0, 0);
    await frameDocument.fonts?.ready;
    await inlineFrameImages(frameDocument);

    const pages = [...frameDocument.querySelectorAll(".template-page")];
    if (!pages.length) throw new Error("PDF로 만들 계획안 페이지가 없습니다.");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    for (let index = 0; index < pages.length; index += 1) {
      const canvas = await html2canvas(pages[index], {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
        windowWidth: pages[index].scrollWidth,
        windowHeight: pages[index].scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });
      if (index > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    return pdf.output("blob");
  } finally {
    frame.remove();
  }
}

export function downloadPdfBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = String(filename || "lesson-plan.pdf").replace(/[\\/:*?"<>|]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
