/**
 * 최초 로그인 시 비밀번호 강제 변경 여부.
 *
 * - true  → user_metadata.must_change_password 가 true 인 사용자는 로그인 후 변경 화면으로 이동
 * - false → 강제 변경 비활성 (마이페이지 '비밀번호 변경' 메뉴는 그대로 사용 가능)
 *
 * 다시 활성화: 아래 IS_PASSWORD_CHANGE_REQUIRED 를 true 로 바꾸거나
 * .env.local 에 VITE_PASSWORD_CHANGE_REQUIRED=true 설정
 */
const ENV_FLAG = import.meta.env.VITE_PASSWORD_CHANGE_REQUIRED;

export const IS_PASSWORD_CHANGE_REQUIRED = ENV_FLAG === "true"
  ? true
  : ENV_FLAG === "false"
    ? false
    : false;

export function shouldForcePasswordChange(session) {
  if (!IS_PASSWORD_CHANGE_REQUIRED) return false;
  return Boolean(session?.user?.user_metadata?.must_change_password);
}
