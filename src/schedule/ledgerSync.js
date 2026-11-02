import { scheduleSupabase } from "./api.js";

/** 월별 정산 결과를 GTS 회계장부 시트(기관 수입 장부·지출 장부)로 보낸다. */
export async function syncMonthToLedger(yearMonth) {
  const { data: sessionData, error: sessionError } = await scheduleSupabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
  }
  let response;
  try {
    response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gear-ledger-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "sync", year_month: yearMonth }),
    });
  } catch {
    throw new Error("장부 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error) {
    throw new Error(result?.error || `장부 전송에 실패했습니다. (오류 ${response.status})`);
  }
  return result.data;
}
