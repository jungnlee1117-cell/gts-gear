import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkitMod from "npm:@pdf-lib/fontkit@1.1.1";
import { buildContractDocument, COMPANY_CEO, COMPANY_NAME, formatResidentFront, formatSignedAtKst } from "./contractTemplate.js";

const fontkit = fontkitMod?.default || fontkitMod;

const FONT_URLS = [
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@Sans2.004/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
  "https://raw.githubusercontent.com/googlefonts/noto-cjk/Sans2.004/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
];

let cachedFontBytes = null;

export async function loadKoreanFontBytes() {
  if (cachedFontBytes) return cachedFontBytes;
  let lastErr = null;
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastErr = new Error(`font ${res.status}`);
        continue;
      }
      cachedFontBytes = new Uint8Array(await res.arrayBuffer());
      if (cachedFontBytes.length > 10000) return cachedFontBytes;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("font fetch failed");
}

async function embedKoreanFont(pdf) {
  pdf.registerFontkit(fontkit);
  const fontBytes = await loadKoreanFontBytes();
  try {
    return await pdf.embedFont(fontBytes, { subset: true });
  } catch {
    return await pdf.embedFont(fontBytes);
  }
}

function wrapLine(font, text, size, maxWidth) {
  const raw = String(text || "");
  if (!raw) return [""];
  const chars = [...raw];
  const lines = [];
  let current = "";
  for (const ch of chars) {
    const next = current + ch;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = ch;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function makeDrawer(pdf, font) {
  const pageSize = [595.28, 841.89];
  const margin = 50;
  const maxWidth = pageSize[0] - margin * 2;
  const lineGap = 15;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - 56;
  const addPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - 56;
    return page;
  };
  const ensure = (need) => {
    if (y - need < 56) addPage();
  };
  const drawWrapped = (text, size, { extra = 0, color = rgb(0.12, 0.16, 0.22), indent = 0 } = {}) => {
    const lines = wrapLine(font, text, size, maxWidth - indent);
    for (const line of lines) {
      ensure(lineGap);
      page.drawText(line, { x: margin + indent, y, size, font, color });
      y -= lineGap + extra;
    }
  };
  return { pageSize, margin, drawWrapped, ensure, getPage: () => page, getY: () => y, setY: (v) => { y = v; } };
}

export async function generateGtsContractPdf(input) {
  const doc = buildContractDocument(input);
  const pdf = await PDFDocument.create();
  const font = await embedKoreanFont(pdf);
  const { drawWrapped, ensure, setY, getY } = makeDrawer(pdf, font);

  drawWrapped(doc.title, 18, { extra: 4 });
  setY(getY() - 6);

  for (const section of doc.sections) {
    if (section.heading) {
      setY(getY() - 4);
      drawWrapped(section.heading, 12, { extra: 2, color: rgb(0.08, 0.2, 0.16) });
    }
    for (const para of section.paragraphs) {
      drawWrapped(para, 10.5, { indent: section.heading ? 2 : 0 });
    }
  }

  ensure(220);
  setY(getY() - 16);
  drawWrapped("서명란", 12, { extra: 2, color: rgb(0.08, 0.2, 0.16) });
  for (const line of doc.signatureBlock.lines) {
    if (line) drawWrapped(line, 10.5);
    else setY(getY() - 8);
  }

  return {
    bytes: new Uint8Array(await pdf.save()),
    document: doc,
  };
}

export async function appendSignedPartyPage(originalBytes, {
  teacherName,
  teacherPhone,
  residentFront,
  signedAt,
  signaturePng,
}) {
  const pdf = await PDFDocument.load(originalBytes);
  const font = await embedKoreanFont(pdf);
  const png = await pdf.embedPng(signaturePng);
  const page = pdf.addPage([595.28, 841.89]);
  const margin = 50;
  let y = 780;
  const draw = (text, size = 11) => {
    page.drawText(text, { x: margin, y, size, font, color: rgb(0.12, 0.16, 0.22) });
    y -= 18;
  };
  draw("서명 완료", 16);
  y -= 8;
  draw("갑");
  draw(`회사명: ${COMPANY_NAME}`);
  draw(`대표자: ${COMPANY_CEO}`);
  draw("대표자 서명: (인)");
  y -= 16;
  draw("을");
  draw(`성명: ${teacherName || ""}`);
  draw(`주민등록번호: ${formatResidentFront(residentFront)}`);
  draw(`연락처: ${teacherPhone || "미등록"}`);
  draw("전자서명:");
  const sigWidth = 160;
  const sigHeight = Math.min(70, sigWidth * (png.height / png.width));
  page.drawImage(png, { x: margin, y: y - sigHeight + 8, width: sigWidth, height: sigHeight });
  y -= sigHeight + 16;
  draw(`서명일시: ${signedAt || formatSignedAtKst(new Date())}`);
  return new Uint8Array(await pdf.save());
}
