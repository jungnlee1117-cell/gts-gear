import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import fontkitMod from "npm:@pdf-lib/fontkit@1.1.1";
import { buildContractDocument, COMPANY_CEO, COMPANY_NAME, formatResidentFront, formatSignedAtKst, formatRateLine, formatDotDate } from "./contractTemplate.js";

import { COMPANY_LOGO_PDF, COMPANY_STAMP_PNG } from "./contractAssets.js";

const fontkit = fontkitMod?.default || fontkitMod;

const FONT_URLS = [
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf",
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
  // TrueType outlines keep Korean text consistent in browser viewers and printing.
  return await pdf.embedFont(fontBytes, { subset: true });
}

function wrapLine(font, text, size, maxWidth) {
  const raw = String(text || "");
  if (!raw) return [""];
  if (/[\r\n]/.test(raw)) return raw.split(/\r?\n/).flatMap(line => wrapLine(font, line, size, maxWidth));
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

const GREEN = rgb(0.08, 0.30, 0.23);
const INK = rgb(0.14, 0.19, 0.19);
const MUTED = rgb(0.40, 0.46, 0.45);
const PALE = rgb(0.95, 0.97, 0.95);
const RULE = rgb(0.83, 0.88, 0.85);
const W = 595.28, H = 841.89, M = 46, CONTENT = W - M * 2;

async function brandAssets(pdf) {
  const logoPdf = await PDFDocument.load(Uint8Array.from(atob(COMPANY_LOGO_PDF), c => c.charCodeAt(0)));
  const logo = await pdf.embedPage(logoPdf.getPage(0), { left: 145, bottom: 10, right: 455, top: 365 });
  const stamp = await pdf.embedPng(COMPANY_STAMP_PNG);
  return { logo, stamp };
}

function pageFrame(pdf, font, assets, label = "교육용역 위탁 계약서") {
  const page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: H - 7, width: W, height: 7, color: GREEN });
  page.drawPage(assets.logo, { x: M, y: H - 72, width: 36, height: 41 });
  page.drawText("GTS", { x: M + 47, y: H - 50, size: 17, font, color: GREEN });
  page.drawText("지티에스", { x: M + 48, y: H - 66, size: 8.5, font, color: MUTED });
  page.drawText(label, { x: W - M - font.widthOfTextAtSize(label, 9), y: H - 53, size: 9, font, color: MUTED });
  page.drawLine({ start: { x: M, y: H - 86 }, end: { x: W - M, y: H - 86 }, color: RULE, thickness: 0.8 });
  return page;
}

function footer(pdf, font) {
  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    page.drawLine({ start: { x: M, y: 42 }, end: { x: W - M, y: 42 }, color: RULE, thickness: 0.7 });
    page.drawText("GTS  |  교육용역 위탁 계약서", { x: M, y: 27, size: 7.5, font, color: MUTED });
    const text = `${i + 1} / ${pages.length}`;
    page.drawText(text, { x: W - M - font.widthOfTextAtSize(text, 8), y: 27, size: 8, font, color: MUTED });
  });
}

function signatureCards(page, font, assets, y, { teacherName, teacherPhone, contractDate }) {
  const gap = 16, cw = (CONTENT - gap) / 2, height = 150;
  const draw = (text, x, yy, size = 10, color = INK) => page.drawText(text, { x, y: yy, size, font, color });
  for (const x of [M, M + cw + gap]) page.drawRectangle({ x, y: y - height, width: cw, height, color: PALE, borderColor: RULE, borderWidth: 0.6 });
  draw(`회사명   ${COMPANY_NAME}`, M + 16, y - 48);
  draw(`대표자   ${COMPANY_CEO}`, M + 16, y - 70);
  draw("회사 날인", M + 16, y - 104, 8.5, MUTED);
  page.drawImage(assets.stamp, { x: M + cw - 78, y: y - 123, width: 54, height: 54 });
  const x = M + cw + gap;
  // Wrap variable identity fields to prevent collision with the signature box.
  wrapLine(font, `성명   ${teacherName}`, 10, cw - 32).slice(0, 2).forEach((line, i) => draw(line, x + 16, y - 48 - i * 13));
  draw(`연락처   ${teacherPhone || "미등록"}`, x + 16, y - 76, 8.5);
  draw("서명", x + 16, y - 104, 8.5, MUTED);
  page.drawLine({ start: { x: x + 54, y: y - 121 }, end: { x: x + cw - 16, y: y - 121 }, color: RULE, thickness: 0.8 });
  const dateLabel = `계약일  ${contractDate}`;
  draw(dateLabel, (W - font.widthOfTextAtSize(dateLabel, 11)) / 2, y + 22, 11, GREEN);
  return { x: x + 57, y: y - 119, width: cw - 76, height: 37, signedAtX: x + 16, signedAtY: y - 138 };
}

export async function generateGtsContractPdf(input) {
  const doc = buildContractDocument(input);
  const pdf = await PDFDocument.create();
  const font = await embedKoreanFont(pdf);
  const assets = await brandAssets(pdf);
  pdf.setTitle(`${doc.title} · ${doc.teacherName}`);
  pdf.setAuthor(COMPANY_NAME);
  pdf.setCreator("GTS 계약서");
  let page = pageFrame(pdf, font, assets);
  let y = H - 121;
  const newPage = () => { page = pageFrame(pdf, font, assets); y = H - 112; };
  const ensure = height => { if (y - height < 62) newPage(); };
  const line = (text, size = 9.5, color = INK, x = M) => {
    page.drawText(text, { x, y, font, size, color });
  };
  const para = (text, size = 9.5) => {
    const lines = wrapLine(font, text, size, CONTENT - 4);
    const need = lines.length * 14.5 + 4;
    if (need <= 630) ensure(need);
    for (const t of lines) { ensure(14.5); line(t, size, INK, M + 2); y -= 14.5; }
    y -= 4;
  };
  line(doc.title, 25, GREEN, (W - font.widthOfTextAtSize(doc.title, 25)) / 2);
  y -= 24;
  const subtitle = "교육 서비스 제공에 관한 권리와 의무";
  line(subtitle, 10, MUTED, (W - font.widthOfTextAtSize(subtitle, 10)) / 2);
  y -= 18;
  const rates = doc.rates.flatMap(rate => wrapLine(font, formatRateLine(rate), 10, CONTENT - 102));
  const summaryH = 64 + rates.length * 16;
  ensure(summaryH + 20);
  page.drawRectangle({ x: M, y: y - summaryH, width: CONTENT, height: summaryH, color: PALE });
  const summaryLine = (label, value, yy) => {
    page.drawText(label, { x: M + 16, y: yy, size: 9, font, color: MUTED });
    page.drawText(value, { x: M + 88, y: yy, size: 10, font, color: GREEN });
  };
  summaryLine("계약 당사자", `${COMPANY_NAME}  /  ${doc.teacherName}`, y - 22);
  summaryLine("계약 기간", `${formatDotDate(doc.startDate)} ~ ${formatDotDate(doc.endDate)}`, y - 42);
  rates.forEach((rate, i) => summaryLine(i ? "" : "용역 단가", rate, y - 62 - i * 16));
  y -= summaryH + 24;
  for (const section of doc.sections.slice(0, -1)) {
    if (section.heading) {
      // Keep each heading together with at least the first two body lines.
      ensure(34 + Math.min(630, wrapLine(font, section.paragraphs[0] || "", 9.5, CONTENT - 4).length * 14.5 + 4));
      y -= 4;
      page.drawRectangle({ x: M, y: y - 6, width: 3, height: 16, color: GREEN });
      line(section.heading.replace(/\s+/g, " "), 11, GREEN, M + 12);
      y -= 24;
    }
    for (const text of section.paragraphs) para(text);
    y -= 4;
  }
  const closingLines = doc.sections.at(-1).paragraphs.flatMap(text => wrapLine(font, text, 10, CONTENT - 24));
  const closingHeight = closingLines.length * 16 + 20;
  // Keep a normal closing confirmation with the date and both signature cards.
  if (closingHeight + 198 <= 660) ensure(closingHeight + 198);
  else ensure(48);
  y -= 8;
  for (const text of closingLines) {
    ensure(16);
    line(text, 10, INK, (W - font.widthOfTextAtSize(text, 10)) / 2);
    y -= 16;
  }
  y -= 20;
  ensure(198);
  y -= 38;
  const position = signatureCards(page, font, assets, y, { teacherName: doc.teacherName, teacherPhone: doc.teacherPhone, contractDate: doc.placeholders.contract_date });
  pdf.setSubject(JSON.stringify({ gtsLayout: 3, teacherName: doc.teacherName, signature: { pageIndex: pdf.getPageCount() - 1, ...position } }));
  footer(pdf, font);
  return { bytes: new Uint8Array(await pdf.save()), document: doc };
}

export async function appendSignedPartyPage(originalBytes, { teacherName, teacherPhone, residentFront, signedAt, signaturePng }) {
  const pdf = await PDFDocument.load(originalBytes);
  const font = await embedKoreanFont(pdf);
  const png = await pdf.embedPng(signaturePng);
  const timestamp = signedAt || formatSignedAtKst(new Date());
  let metadata;
  try { metadata = JSON.parse(pdf.getSubject() || "{}"); } catch { metadata = {}; }
  if ([2, 3].includes(metadata.gtsLayout) && metadata.signature) {
    const s = metadata.signature;
    const page = pdf.getPage(s.pageIndex);
    const scale = Math.min(s.width / png.width, s.height / png.height);
    page.drawImage(png, { x: s.x + (s.width - png.width * scale) / 2, y: s.y, width: png.width * scale, height: png.height * scale });
    if (metadata.gtsLayout === 2) {
      const timestampFont = await pdf.embedFont(StandardFonts.Helvetica);
      page.drawText(`${timestamp} KST`, { x: s.signedAtX + 34, y: s.signedAtY, size: 7, font: timestampFont, color: INK });
    }
    return new Uint8Array(await pdf.save());
  }
  // Previously issued PDFs keep their original pages and receive a completion page.
  const assets = await brandAssets(pdf);
  const page = pageFrame(pdf, font, assets, "전자서명 완료 확인");
  page.drawText("전자서명 완료", { x: M, y: H - 132, size: 23, font, color: GREEN });
  page.drawText("앞의 계약서 원문에 대한 수탁자의 전자서명입니다.", { x: M, y: H - 162, size: 10, font, color: MUTED });
  // Do not add a new company seal to a previously issued contract.
  page.drawText(`성명  ${teacherName || ""}`, { x: M, y: H - 211, size: 12, font, color: INK });
  page.drawText(`연락처  ${teacherPhone || "미등록"}`, { x: M, y: H - 235, size: 10, font, color: INK });
  page.drawText(`주민등록번호  ${formatResidentFront(residentFront)}`, { x: M, y: H - 259, size: 10, font, color: INK });
  const scale = Math.min(180 / png.width, 80 / png.height);
  page.drawImage(png, { x: M, y: H - 375, width: png.width * scale, height: png.height * scale });
  page.drawText(`서명일시  ${timestamp} (한국시간)`, { x: M, y: H - 410, size: 10, font, color: INK });
  return new Uint8Array(await pdf.save());
}
