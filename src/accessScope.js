import { isGearOnlyAccess } from "./authRoles.js";

/** 교구 대여 신청 / 반납 / 재고 조회만 */
export const GEAR_ONLY_PAGES = new Set([
  "items",
  "items-browse",
  "item-detail",
  "set-detail",
  "qr-scan",
  "qr-rent",
  "rental-return",
  "rentals",
  "my-rental-status",
  "return-request",
  "my-reservations",
]);

export const GEAR_ONLY_SIDEBAR_NAV = [
  { type: "item", id: "items-browse", label: "교구 둘러보기", glyph: "items-browse" },
  { type: "item", id: "items", label: "교구검색", glyph: "items" },
  { type: "item", id: "qr-scan", label: "QR 스캔", glyph: "qr-scan" },
  { type: "item", id: "rental-return", label: "대여 반납신청", glyph: "rental-return" },
  { type: "item", id: "my-reservations", label: "내 예약 현황", glyph: "my-reservations" },
];

export const GEAR_ONLY_MOBILE_BOTTOM_NAV = [
  { id: "items", label: "교구검색", glyph: "items" },
  { id: "my-rental-status", label: "내대여현황", glyph: "my-rental-status" },
  { id: "return-request", label: "반납요청", glyph: "returns-approval" },
  { id: "more", label: "더보기", glyph: "more" },
];

export function gearOnlyHomePage() {
  return "items";
}

export function isGearOnlyPageAllowed(page) {
  return GEAR_ONLY_PAGES.has(page);
}

export function isGearOnlyPathAllowed(pathname, search = "") {
  if (pathname === "/" || pathname === "") return true;
  if (pathname === "/gear") {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const page = new URLSearchParams(raw).get("page");
    if (!page) return true;
    return isGearOnlyPageAllowed(page);
  }
  return false;
}

export function filterHubModulesForAccess(modules, me) {
  if (!isGearOnlyAccess(me)) return modules;
  return (modules || []).filter((mod) => mod.id === "edu");
}
