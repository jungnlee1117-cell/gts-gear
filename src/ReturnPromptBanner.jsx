/**
 * 대여 중 교구가 있을 때 반납 화면으로 보내는 안내 배너
 */
export default function ReturnPromptBanner({ heldCount, onGoReturn }) {
  const n = Math.max(0, Number(heldCount) || 0);
  if (n < 1 || typeof onGoReturn !== "function") return null;

  return (
    <button
      type="button"
      className="gts-return-prompt-banner"
      onClick={onGoReturn}
      aria-label={`현재 대여 중인 교구 ${n}개, 반납하러 가기`}
    >
      <span className="gts-return-prompt-banner__accent" aria-hidden />
      <span className="gts-return-prompt-banner__body">
        <span className="gts-return-prompt-banner__title">
          반납할 교구가 있어요
        </span>
        <span className="gts-return-prompt-banner__sub">
          현재 대여 중인 교구 {n}개 · 반납하러 가기
        </span>
      </span>
      <span className="gts-return-prompt-banner__cta">반납하기 →</span>
    </button>
  );
}

/** 본인 대여 중 보유 수량 합 (건수) */
export function sumHeldQuantity(rentals) {
  return (rentals || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
}
