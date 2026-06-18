/** 마지막 방문 경로 저장 — 새로고침·로그인 후 복원용 */
export const HOME_PATH = "/";
const LAST_ROUTE_KEY = "gts-last-route";
const RESTORE_FLAG = "gts-restore-route-after-login";

export function saveLastRoute(path) {
  if (!path || path === HOME_PATH) return;
  try {
    localStorage.setItem(LAST_ROUTE_KEY, path);
  } catch { /* ignore */ }
}

export function getLastRoute() {
  try {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    return saved && saved !== HOME_PATH ? saved : null;
  } catch {
    return null;
  }
}

export function markRestoreAfterLogin() {
  try {
    sessionStorage.setItem(RESTORE_FLAG, "1");
  } catch { /* ignore */ }
}

export function consumeRestoreAfterLogin() {
  try {
    const flag = sessionStorage.getItem(RESTORE_FLAG);
    if (flag) sessionStorage.removeItem(RESTORE_FLAG);
    return Boolean(flag);
  } catch {
    return false;
  }
}
