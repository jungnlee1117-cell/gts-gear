/** 아직 반납이 끝나지 않은 대여 교구 안내. 없으면 빈 문자열. */
export function unreturnedGearBlockMessage(teacherName, rentals, actionLabel = "비활성화") {
  const lines = (rentals || []).map((row) => {
    const name = row?.items?.name || row?.name || "교구";
    const qty = Math.max(1, Number(row?.quantity) || 1);
    return `${name} × ${qty}`;
  });
  if (!lines.length) return "";
  const name = teacherName || "이 선생님";
  return [
    `${name} 선생님은 반납되지 않은 교구가 ${lines.length}건 있습니다.`,
    ...lines.map((line) => `· ${line}`),
    `교구를 반납한 뒤에 ${actionLabel}할 수 있습니다.`,
  ].join("\n");
}
