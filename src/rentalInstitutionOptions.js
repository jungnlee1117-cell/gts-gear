/**
 * rental_requests.dispatch_location 은 NOT NULL 이고 기본값이 없다.
 * 신청 화면에서는 기관을 고르지 않으므로, 새 행에는 이 문구를 넣고 화면에는 그리지 않는다.
 * 광교폴리, 사무실처럼 이미 저장된 이름은 그대로 보여 준다.
 */
export const OMITTED_RENTAL_LOCATION = "교구 관리자 대여";

export function visibleRentalLocation(value) {
  const text = String(value ?? "").trim();
  if (!text || text === OMITTED_RENTAL_LOCATION) return "";
  return text;
}

export function rentalPartyTitle(name, location) {
  const who = String(name || "").trim() || "선생님";
  const place = visibleRentalLocation(location);
  return place ? `${who} · ${place}` : who;
}
