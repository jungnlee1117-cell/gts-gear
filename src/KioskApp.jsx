import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  CalendarDays,
  ChevronRight,
  Megaphone,
  UserRound,
} from "lucide-react";
import { DEFAULT_GEAR_CATEGORIES, mergeCategoriesWithDefaults } from "./gearCategoryData.js";
import { invokeKioskPublic, KioskError } from "./kioskApi.js";
import { resolveRotationSchedules, yearMonthKey, findCurrentRotationWeekSlot } from "./itemRotation.js";
import {
  clampToSchoolYear,
  monthLabel,
  nextSchoolYearMonth,
  prevSchoolYearMonth,
  schoolYearStartYear,
} from "./lessonPlan.js";
import { buildMonthGearSections } from "./teacherGearStatus.js";
import { GearCategoriesProvider } from "./GearCategoriesContext.jsx";
import { getItemsBrowsePage } from "./itemsBrowseRegistry.js";
import "./kiosk.css";

const TOKEN_KEY = "gts_kiosk_token";
const BRANCHES = ["사무실", "엘리트코어", "삼성점", "한남점", "나비에로"];
const DEFAULT_RENT_DAYS = 7;

function todayYmdLocal(offsetDays = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatKoMonthDay(ymd) {
  if (!ymd) return "";
  const parts = String(ymd).slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || !parts[1] || !parts[2]) return String(ymd).slice(0, 10);
  return `${parts[1]}월 ${parts[2]}일`;
}

function sundayOfWeekContainingLocal(ymd = todayYmdLocal(0)) {
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(ymd).slice(0, 10);
  d.setDate(d.getDate() - d.getDay());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdAddDaysLocal(ymd, deltaDays) {
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function relativeGuideWeekTagLocal(weekStart, weekEnd) {
  const thisSunday = sundayOfWeekContainingLocal(todayYmdLocal(0));
  const thisSaturday = ymdAddDaysLocal(thisSunday, 6);
  const nextSunday = ymdAddDaysLocal(thisSunday, 7);
  const nextSaturday = ymdAddDaysLocal(thisSunday, 13);
  const ws = String(weekStart || "").slice(0, 10);
  const we = String(weekEnd || "").slice(0, 10);
  if (!ws || !we || !thisSaturday || !nextSunday || !nextSaturday) return null;
  const overlapDayCount = (aStart, aEnd, bStart, bEnd) => {
    const start = aStart > bStart ? aStart : bStart;
    const end = aEnd < bEnd ? aEnd : bEnd;
    if (start > end) return 0;
    const startDate = new Date(`${start}T12:00:00`);
    const endDate = new Date(`${end}T12:00:00`);
    return Math.floor((endDate - startDate) / 86400000) + 1;
  };
  const thisDays = overlapDayCount(ws, we, thisSunday, thisSaturday);
  const nextDays = overlapDayCount(ws, we, nextSunday, nextSaturday);
  // DB 주차가 월~일이어도 키오스크 기준(일~토)에 더 많이 포함되는 한 주만 표시한다.
  // 경계의 일요일 하루만 겹치는 앞 주가 함께 선택되는 문제를 방지한다.
  if (thisDays >= 4 && thisDays > nextDays) return "이번주";
  if (nextDays >= 4 && nextDays > thisDays) return "다음주";
  return null;
}

function formatRelativeGuideLabelLocal(weekStart, weekEnd, teacherName) {
  if (!teacherName) return "";
  const tag = relativeGuideWeekTagLocal(weekStart, weekEnd);
  if (!tag) return "";
  return `${tag} ${teacherName} 선생님 정규교구`;
}

/** 이번주·다음주(일~토)에 겹치는 안내만 */
function rotationGuidesForItem(guidesByItem, itemId, { withinGuideWindow = true } = {}) {
  if (!itemId || !guidesByItem) return [];
  const list = guidesByItem[itemId] || guidesByItem[String(itemId)] || [];
  if (!Array.isArray(list) || !list.length) return [];
  if (!withinGuideWindow) return list;
  return list
    .map((g) => {
      const tag = g?.relative_week || relativeGuideWeekTagLocal(g?.week_start, g?.week_end);
      if (!tag) return null;
      const label = String(g?.label || "").trim()
        || formatRelativeGuideLabelLocal(g?.week_start, g?.week_end, g?.teacher_name);
      return { ...g, relative_week: tag, label };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ra = a.relative_week === "이번주" ? 0 : 1;
      const rb = b.relative_week === "이번주" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return String(a.week_start).localeCompare(String(b.week_start));
    });
}

/** 대여 기간(오늘~N일)과 겹치는 다른 선생님 순환 배정 */
function findKioskRentConflicts(guidesByItem, cartItems, renterId) {
  const start = todayYmdLocal(0);
  const end = todayYmdLocal(DEFAULT_RENT_DAYS);
  const out = [];
  const seen = new Set();
  for (const item of cartItems || []) {
    const guides = rotationGuidesForItem(guidesByItem, item.id);
    for (const g of guides) {
      if (!g?.teacher_id || g.teacher_id === renterId) continue;
      if (!g.week_start || !g.week_end) continue;
      if (!(start <= g.week_end && end >= g.week_start)) continue;
      const key = `${item.id}|${g.teacher_id}|${g.week_start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        itemId: item.id,
        itemName: item.name,
        teacherId: g.teacher_id,
        teacherName: g.teacher_name || "다른 선생님",
        weekStart: g.week_start,
        weekEnd: g.week_end,
        untilYmd: g.until_ymd,
        label: g.label,
      });
    }
  }
  out.sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)));
  return out;
}

function RotationConflictModal({ conflicts, reason, onReasonChange, onConfirm, onCancel, busy }) {
  if (!conflicts?.length) return null;
  const lines = conflicts.map((c) => (
    `이 교구는 ${c.teacherName}님의 ${formatKoMonthDay(c.weekStart)} 정규수업에 필요해요.`
  ));
  const uniqueLines = [...new Set(lines)];
  return (
    <div className="kiosk-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="kiosk-conflict-title">
      <div className="kiosk-modal">
        <h2 id="kiosk-conflict-title">정규수업 교구 안내</h2>
        <div className="kiosk-modal-body">
          {uniqueLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="kiosk-modal-ask">그래도 대여하시겠어요?</p>
          <label className="kiosk-modal-reason-label" htmlFor="kiosk-conflict-reason">
            사유 (선택)
          </label>
          <textarea
            id="kiosk-conflict-reason"
            className="kiosk-modal-reason"
            rows={2}
            maxLength={120}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="예: 체험 수업용, 당일 반납 예정"
            disabled={busy}
          />
        </div>
        <div className="kiosk-modal-actions">
          <button type="button" className="kiosk-btn kiosk-btn--ghost" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button type="button" className="kiosk-btn kiosk-btn--primary" onClick={onConfirm} disabled={busy}>
            {busy ? "처리 중..." : "그래도 대여"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RegularClassAddConfirmModal({ guide, itemName, onConfirm, onCancel }) {
  if (!guide) return null;
  const weekTag = guide.relative_week || "이번주";
  const teacherName = guide.teacher_name || "선생님";
  return (
    <div className="kiosk-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="kiosk-guide-add-title">
      <div className="kiosk-modal">
        <h2 id="kiosk-guide-add-title">정규수업 교구 확인</h2>
        <div className="kiosk-modal-body">
          <p>
            이 교구{itemName ? `(${itemName})` : ""}는{" "}
            <strong>{teacherName}</strong>님의 <strong>{weekTag}</strong> 정규수업에 필요해요.
          </p>
          <p className="kiosk-modal-ask">그래도 담으시겠어요?</p>
        </div>
        <div className="kiosk-modal-actions">
          <button type="button" className="kiosk-btn kiosk-btn--ghost" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="kiosk-btn kiosk-btn--primary" onClick={onConfirm}>
            그래도 담기
          </button>
        </div>
      </div>
    </div>
  );
}

function RotationGuideLines({ guides }) {
  const lines = (guides || [])
    .map((g) => {
      const label = String(g?.label || "").trim()
        || formatRelativeGuideLabelLocal(g?.week_start, g?.week_end, g?.teacher_name);
      if (!label) return null;
      return { ...g, label };
    })
    .filter(Boolean)
    .slice(0, 3);
  if (!lines.length) return null;
  return (
    <div className="kiosk-rotation-guides">
      {lines.map((g) => (
        <div key={`${g.teacher_id}-${g.week_start}-${g.label}`} className="kiosk-rotation-guide">
          {g.label}
        </div>
      ))}
    </div>
  );
}
const KIOSK_MANIFEST = "/kiosk.webmanifest";

function isDisplayStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: fullscreen)").matches
      || Boolean(window.navigator.standalone);
  } catch {
    return false;
  }
}

function isIosDevice() {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}

function KioskInstallHint() {
  if (isDisplayStandalone()) return null;
  const ios = isIosDevice();
  return (
    <div className="kiosk-install-hint">
      <strong>홈 화면에 키오스크로 추가</strong>
      <p>
        {ios
          ? "기존 홈화면 아이콘을 삭제한 뒤, /kiosk 에서 Safari 공유 → 「홈 화면에 추가」를 다시 해 주세요. 홈화면 이름이 「키오스크」인지 확인하세요. 「GTS」이면 메인 앱입니다."
          : "기존 아이콘을 지우고 /kiosk 에서 「앱 설치」를 다시 해 주세요. 아이콘 이름이 「키오스크」여야 하며, 메인 「GTS」와는 별도입니다."}
      </p>
      <code>{typeof window !== "undefined" ? `${window.location.origin}/kiosk` : "/kiosk"}</code>
    </div>
  );
}

function loadToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function PinPad({ value, onChange, onSubmit, disabled, title, subtitle }) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
  const press = (d) => {
    if (disabled) return;
    if (digits.length >= 4) return;
    onChange(digits + d);
  };
  const back = () => {
    if (disabled) return;
    onChange(digits.slice(0, -1));
  };
  useEffect(() => {
    if (digits.length === 4 && onSubmit) onSubmit(digits);
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="kiosk-pin">
      {title ? <h2 className="kiosk-pin-title">{title}</h2> : null}
      {subtitle ? <p className="kiosk-pin-sub">{subtitle}</p> : null}
      <div className="kiosk-pin-dots" aria-label={`PIN ${digits.length}자리 입력됨`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`kiosk-pin-dot${digits.length > i ? " filled" : ""}`} />
        ))}
      </div>
      <div className="kiosk-pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => {
          if (key === "") return <span key="empty" className="kiosk-pin-key kiosk-pin-key--empty" />;
          if (key === "⌫") {
            return (
              <button key="back" type="button" className="kiosk-pin-key" onClick={back} disabled={disabled} aria-label="지우기">
                ⌫
              </button>
            );
          }
          return (
            <button key={key} type="button" className="kiosk-pin-key" onClick={() => press(key)} disabled={disabled}>
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QtyStepper({ value, min = 1, max = 99, onChange }) {
  return (
    <div className="kiosk-qty">
      <button
        type="button"
        className="kiosk-qty-btn"
        aria-label="수량 감소"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={28} />
      </button>
      <div className="kiosk-qty-value" aria-live="polite">{value}</div>
      <button
        type="button"
        className="kiosk-qty-btn"
        aria-label="수량 증가"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={28} />
      </button>
    </div>
  );
}

function SuccessScreen({ title, detail, onDone }) {
  const [left, setLeft] = useState(3);
  useEffect(() => {
    const t = window.setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          window.clearInterval(t);
          onDone?.();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [onDone]);

  return (
    <div className="kiosk-success">
      <CheckCircle2 size={72} strokeWidth={1.75} className="kiosk-success-icon" />
      <h2>{title}</h2>
      {detail ? <p>{detail}</p> : null}
      <p className="kiosk-success-timer">{left}초 후 처음 화면으로</p>
      <button type="button" className="kiosk-btn kiosk-btn--ghost" onClick={onDone}>
        지금 돌아가기
      </button>
    </div>
  );
}

function formatNoticeDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function KioskNoticeSlider({ notices }) {
  const list = notices || [];
  const [idx, setIdx] = useState(0);
  const [openNotice, setOpenNotice] = useState(null);

  useEffect(() => {
    if (list.length <= 1 || openNotice) return undefined;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % list.length);
    }, 5500);
    return () => window.clearInterval(t);
  }, [list.length, openNotice]);

  useEffect(() => {
    if (!openNotice) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpenNotice(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openNotice]);

  useEffect(() => {
    if (idx >= list.length) setIdx(0);
  }, [idx, list.length]);

  if (!list.length) {
    return (
      <div className="kiosk-notice-slider kiosk-notice-slider--empty">
        <Megaphone size={22} strokeWidth={1.75} aria-hidden />
        <div>
          <div className="kiosk-notice-slider-title">공지사항</div>
          <div className="kiosk-notice-slider-body">등록된 공지가 없습니다.</div>
        </div>
      </div>
    );
  }

  const n = list[idx] || list[0];
  const urgent = n.importance === "important";
  const birthday = n.kind === "birthday";

  return (
    <>
    <div
      className={`kiosk-notice-slider${urgent ? " is-urgent" : ""}${birthday ? " is-birthday" : ""}`}
      aria-live="polite"
      role="button"
      tabIndex={0}
      aria-label={`${n.title} 공지사항 전체보기`}
      onClick={() => setOpenNotice(n)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") setOpenNotice(n);
      }}
    >
      <div className="kiosk-notice-slider-badge">
        {birthday ? "생일" : urgent ? "공고" : "공지"}
      </div>
      <div className="kiosk-notice-slider-content">
        <div className="kiosk-notice-slider-title">{n.title}</div>
        <div className="kiosk-notice-slider-body">
          {String(n.body || "").trim() || "내용을 확인해 주세요."}
        </div>
        <div className="kiosk-notice-slider-meta">
          {formatNoticeDate(n.created_at)}
          {n.author_name ? ` · ${n.author_name}` : ""}
        </div>
      </div>
      {list.length > 1 ? (
        <div className="kiosk-notice-dots" aria-hidden>
          {list.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`kiosk-notice-dot${i === idx ? " active" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setIdx(i);
              }}
              aria-label={`${i + 1}번째 공지`}
            />
          ))}
        </div>
      ) : null}
    </div>
    {openNotice ? (
      <div className="kiosk-notice-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="kiosk-notice-modal-title" onClick={() => setOpenNotice(null)}>
        <article className="kiosk-notice-modal" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="kiosk-notice-modal-close" onClick={() => setOpenNotice(null)} aria-label="공지사항 닫기">×</button>
          <div className={`kiosk-notice-modal-badge${openNotice.importance === "important" ? " is-urgent" : ""}${openNotice.kind === "birthday" ? " is-birthday" : ""}`}>
            {openNotice.kind === "birthday" ? "생일" : openNotice.importance === "important" ? "공고" : "공지사항"}
          </div>
          <h2 id="kiosk-notice-modal-title">{openNotice.title}</h2>
          <div className="kiosk-notice-modal-meta">
            {formatNoticeDate(openNotice.created_at)}
            {openNotice.author_name ? ` · ${openNotice.author_name}` : ""}
          </div>
          <div className="kiosk-notice-modal-body">
            {String(openNotice.body || "").trim() || "내용을 확인해 주세요."}
          </div>
          <button type="button" className="kiosk-notice-modal-confirm" onClick={() => setOpenNotice(null)}>확인</button>
        </article>
      </div>
    ) : null}
    </>
  );
}

function ItemCard({ item, onSelect, inCart, cartQty, rotationGuides, showGuides }) {
  const name = String(item?.name || "").trim() || "이름 없음";
  const code = String(item?.code || "").trim();
  const available = Number(item?.available);
  const stock = Number.isFinite(available) ? available : 0;
  return (
    <button
      type="button"
      className={`kiosk-item-card${inCart ? " in-cart" : ""}`}
      onClick={() => onSelect(item)}
    >
      <div className="kiosk-item-thumb" aria-hidden>
        {item?.photo_url ? (
          <img src={item.photo_url} alt="" loading="lazy" />
        ) : (
          <Package size={36} strokeWidth={1.5} />
        )}
      </div>
      <div className="kiosk-item-body">
        <div className="kiosk-item-name">{name}</div>
        {code ? <div className="kiosk-item-meta">{code}</div> : null}
        <div className={`kiosk-item-stock${stock <= 0 ? " out" : ""}`}>
          남은 수량 {stock}
        </div>
        {showGuides ? <RotationGuideLines guides={rotationGuides} /> : null}
        {inCart ? (
          <div className="kiosk-item-cart-badge">선택됨 · {cartQty}개</div>
        ) : null}
      </div>
    </button>
  );
}

function QrLoginModal({ pair, error, onClose, onRetry }) {
  return (
    <div className="kiosk-qr-overlay" role="dialog" aria-modal="true" aria-labelledby="kiosk-qr-title">
      <div className="kiosk-qr-card">
        <button type="button" className="kiosk-qr-close" onClick={onClose} aria-label="QR 로그인 닫기">×</button>
        <div className="kiosk-qr-badge">휴대폰 본인 확인</div>
        <h2 id="kiosk-qr-title">GTS QR 로그인</h2>
        <p>휴대폰 카메라로 QR코드를 촬영한 뒤<br />GTS 계정으로 로그인하고 승인해 주세요.</p>
        {pair?.url ? (
          <div className="kiosk-qr-code">
            <QRCodeCanvas value={pair.url} size={250} level="M" includeMargin />
          </div>
        ) : (
          <div className="kiosk-qr-loading">QR코드를 만드는 중...</div>
        )}
        {error ? <p className="kiosk-error">{error}</p> : null}
        <div className="kiosk-qr-status">
          <span className="kiosk-qr-status-dot" /> 휴대폰 승인을 기다리고 있습니다
        </div>
        <div className="kiosk-qr-actions">
          <button type="button" className="kiosk-btn kiosk-btn--ghost" onClick={onClose}>취소</button>
          <button type="button" className="kiosk-btn kiosk-btn--primary" onClick={onRetry}>새 QR 만들기</button>
        </div>
      </div>
    </div>
  );
}

export default function KioskApp() {
  const [token, setToken] = useState(loadToken);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [teacherSession, setTeacherSession] = useState("");
  const [sessionTeacher, setSessionTeacher] = useState(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(0);
  const [sessionRemaining, setSessionRemaining] = useState(0);
  const [qrPair, setQrPair] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrError, setQrError] = useState("");

  const [mode, setMode] = useState("home"); // home | browse | rent | return | week | success
  const [categories, setCategories] = useState(DEFAULT_GEAR_CATEGORIES);
  const [items, setItems] = useState([]);
  const [rotationGuides, setRotationGuides] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [conflictModal, setConflictModal] = useState(null); // { conflicts, pin }
  const [conflictReason, setConflictReason] = useState("");
  const conflictAckRef = useRef(false);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("사무실");

  // rent / return shared wizard
  const [step, setStep] = useState("pick"); // pick | cart | qty | teacher | pin | list
  const [selectedItem, setSelectedItem] = useState(null);
  const [cart, setCart] = useState([]);
  const [qty, setQty] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [homeTeacherQuery, setHomeTeacherQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [successMsg, setSuccessMsg] = useState({ title: "", detail: "" });
  const [holdings, setHoldings] = useState([]);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [returnCart, setReturnCart] = useState({}); // item_id -> quantity
  const [guideConfirm, setGuideConfirm] = useState(null); // { item, quantity, guide }
  const [weekGearExtras, setWeekGearExtras] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => yearMonthKey());
  const [weekFromHome, setWeekFromHome] = useState(false);
  const [rentFromWeek, setRentFromWeek] = useState(false);
  const [showFsBtn, setShowFsBtn] = useState(false);
  const pinSubmitting = useRef(false);
  const cartQtyById = useMemo(
    () => Object.fromEntries(cart.map((c) => [c.id, c.quantity])),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((s, c) => s + c.quantity, 0),
    [cart],
  );

  const browseItems = useMemo(
    () => (items || []).map((it) => ({
      ...it,
      // ItemsBrowsePage availQty = total_quantity - rented; 키오스크 catalog.available 반영
      total_quantity: Math.max(0, Number(it.available) || 0),
      status: it.status || "available",
    })),
    [items],
  );

  const browseCart = useMemo(
    () => cart.map((c) => ({ item_id: c.id, quantity: c.quantity, due_date: "" })),
    [cart],
  );

  const setBrowseCart = useCallback((updater) => {
    const prevBrowse = cart.map((c) => ({ item_id: c.id, quantity: c.quantity, due_date: "" }));
    const nextBrowse = typeof updater === "function" ? updater(prevBrowse) : updater;
    const prevIds = new Set(prevBrowse.map((c) => c.item_id));
    const newlyAdded = (nextBrowse || []).filter((e) => e?.item_id && !prevIds.has(e.item_id));

    if (newlyAdded.length === 1) {
      const entry = newlyAdded[0];
      const guides = rotationGuidesForItem(rotationGuides, entry.item_id);
      if (guides.length) {
        const catalog = items.find((i) => i.id === entry.item_id);
        if (catalog) {
          setGuideConfirm({
            item: catalog,
            quantity: Math.max(1, Number(entry.quantity) || 1),
            guide: guides[0],
          });
          return;
        }
      }
    }

    setCart((prev) => (nextBrowse || []).map((entry) => {
      const existing = prev.find((c) => c.id === entry.item_id);
      if (existing) {
        return { ...existing, quantity: Math.max(1, Number(entry.quantity) || 1) };
      }
      const catalog = items.find((i) => i.id === entry.item_id);
      if (!catalog) return null;
      return {
        id: catalog.id,
        name: catalog.name,
        code: catalog.code,
        photo_url: catalog.photo_url,
        available: catalog.available,
        quantity: Math.max(1, Number(entry.quantity) || 1),
      };
    }).filter(Boolean));
  }, [cart, items, rotationGuides]);

  const addToCartWithGuideCheck = (item, addQty = 1, { force = false } = {}) => {
    if (!item?.id) return false;
    if (item.available <= 0) {
      setFlowError("재고가 없습니다.");
      return false;
    }
    const already = cart.some((c) => c.id === item.id);
    if (!force && !already) {
      const guides = rotationGuidesForItem(rotationGuides, item.id);
      if (guides.length) {
        setGuideConfirm({ item, quantity: addQty, guide: guides[0] });
        return false;
      }
    }
    return addToCart(item, addQty);
  };

  const regularClassGuideByItem = useMemo(() => {
    const map = new Map();
    Object.keys(rotationGuides || {}).forEach((itemId) => {
      const guides = rotationGuidesForItem(rotationGuides, itemId);
      if (!guides.length) return;
      map.set(
        itemId,
        guides.map((g, i) => ({
          key: `${itemId}-${g.teacher_id}-${g.week_start}-${i}`,
          text: g.label || formatRelativeGuideLabelLocal(g.week_start, g.week_end, g.teacher_name),
          type: "regular_class",
        })),
      );
    });
    return map;
  }, [rotationGuides]);

  const browseMe = selectedTeacher || { id: "kiosk", name: "키오스크", role: "teacher" };
  const ItemsBrowsePage = getItemsBrowsePage();

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const resetWizard = useCallback(() => {
    setStep("pick");
    setSelectedItem(null);
    setCart([]);
    setQty(1);
    setSelectedTeacher(null);
    setTeacherPin("");
    setTeacherSearch("");
    setFlowError("");
    setHoldings([]);
    setPendingReturns([]);
    setReturnCart({});
    setGuideConfirm(null);
    setWeekGearExtras(null);
    setViewMonth(yearMonthKey());
    setWeekFromHome(false);
    setRentFromWeek(false);
    pinSubmitting.current = false;
  }, []);

  const goHome = useCallback(() => {
    setMode("home");
    setSearch("");
    setCategoryId("");
    setHomeTeacherQuery("");
    resetWizard();
  }, [resetWizard]);

  const endTeacherSession = useCallback(() => {
    setTeacherSession("");
    setSessionTeacher(null);
    setSessionExpiresAt(0);
    setSessionRemaining(0);
    setQrPair(null);
    setQrOpen(false);
    setQrError("");
    goHome();
  }, [goHome]);

  const openQrLogin = useCallback(async () => {
    setQrOpen(true);
    setQrPair(null);
    setQrError("");
    try {
      const data = await invokeKioskPublic("create_pair");
      const url = new URL("/kiosk-approve", window.location.origin);
      url.searchParams.set("pair", data.pair_id);
      url.searchParams.set("secret", data.pair_secret);
      setQrPair({ ...data, url: url.toString() });
    } catch (err) {
      setQrError(err.message || "QR코드를 만들지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (!qrOpen || !qrPair?.pair_id || !qrPair?.pair_secret) return undefined;
    let stopped = false;
    const check = async () => {
      try {
        const data = await invokeKioskPublic("pair_status", {
          pair_id: qrPair.pair_id,
          pair_secret: qrPair.pair_secret,
        });
        if (stopped) return;
        if (data.status === "approved" && data.teacher_session && data.teacher) {
          setTeacherSession(data.teacher_session);
          setSessionTeacher(data.teacher);
          setSessionExpiresAt(Date.now() + Number(data.expires_in || 600) * 1000);
          setSelectedTeacher(data.teacher);
          setQrOpen(false);
          setQrPair(null);
          setQrError("");
          setToastMsg(`${data.teacher.name} 선생님, 로그인되었습니다.`);
          setMode("home");
          setStep("pick");
        } else if (data.status === "expired" || data.status === "consumed" || data.status === "cancelled") {
          setQrError("QR코드 사용 시간이 끝났습니다. 새 QR을 만들어 주세요.");
        }
      } catch (err) {
        if (!stopped && err?.code !== "PAIR_EXPIRED") setQrError(err.message || "승인 상태를 확인하지 못했습니다.");
      }
    };
    check();
    const timer = window.setInterval(check, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [qrOpen, qrPair?.pair_id, qrPair?.pair_secret]);

  useEffect(() => {
    if (!teacherSession || !sessionExpiresAt) return undefined;
    const update = () => {
      const left = Math.max(0, Math.ceil((sessionExpiresAt - Date.now()) / 1000));
      setSessionRemaining(left);
      if (left <= 0) endTeacherSession();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [teacherSession, sessionExpiresAt, endTeacherSession]);

  const extendTeacherSession = useCallback(async () => {
    if (!teacherSession) return;
    try {
      const data = await invokeKioskPublic("extend_teacher_session", { teacher_session: teacherSession });
      setTeacherSession(data.teacher_session);
      setSessionExpiresAt(Date.now() + Number(data.expires_in || 600) * 1000);
      setToastMsg("키오스크 로그인 시간을 10분 연장했습니다.");
    } catch (err) {
      setToastMsg(err.message || "로그인 시간을 연장하지 못했습니다.");
    }
  }, [teacherSession]);

  const sessionTimeLabel = `${String(Math.floor(sessionRemaining / 60)).padStart(2, "0")}:${String(sessionRemaining % 60).padStart(2, "0")}`;

  const lockDevice = () => {
    saveToken("");
    setToken("");
    setUnlockPin("");
    goHome();
  };

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("kiosk-root");
    body.classList.add("kiosk-root");

    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    let manifestLink = document.querySelector('link[rel="manifest"]');
    const prevHref = manifestLink?.getAttribute("href") || "";
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.setAttribute("href", KIOSK_MANIFEST);

    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const prevAppleTitle = appleTitle?.getAttribute("content") || "";
    if (appleTitle) appleTitle.setAttribute("content", "GTS 키오스크");

    setShowFsBtn(!isDisplayStandalone() && Boolean(document.documentElement.requestFullscreen || document.body.requestFullscreen));
    setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));

    const onFsChange = () => {
      const fs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(fs);
      setShowFsBtn(!fs && !isDisplayStandalone() && Boolean(document.documentElement.requestFullscreen));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);

    return () => {
      html.classList.remove("kiosk-root");
      body.classList.remove("kiosk-root");
      body.style.overflow = prevOverflow;
      if (manifestLink && prevHref) manifestLink.setAttribute("href", prevHref);
      if (appleTitle && prevAppleTitle) appleTitle.setAttribute("content", prevAppleTitle);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  useEffect(() => {
    if (!toastMsg) return undefined;
    const timer = window.setTimeout(() => setToastMsg(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      setIsFullscreen(true);
      setShowFsBtn(false);
    } catch {
      setFlowError("전체화면으로 전환하지 못했습니다. 홈 화면에 추가해 PWA로 실행해 주세요.");
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      setIsFullscreen(false);
      setShowFsBtn(!isDisplayStandalone());
    } catch {
      /* ignore */
    }
  };

  const refreshCatalog = useCallback(async (tok) => {
    setLoadingCatalog(true);
    setCatalogError("");
    try {
      const [catalog, teacherList, noticeList] = await Promise.all([
        invokeKioskPublic("catalog", {}, tok),
        invokeKioskPublic("teachers", {}, tok),
        invokeKioskPublic("notices", {}, tok).catch(() => []),
      ]);
      setCategories(mergeCategoriesWithDefaults(catalog?.categories || []));
      setItems(catalog?.items || []);
      setRotationGuides(catalog?.rotation_guides && typeof catalog.rotation_guides === "object"
        ? catalog.rotation_guides
        : {});
      setTeachers(teacherList || []);
      setNotices(Array.isArray(noticeList) ? noticeList : []);
    } catch (err) {
      if (err instanceof KioskError && (err.code === "DEVICE_LOCKED" || err.status === 401)) {
        saveToken("");
        setToken("");
      }
      setCatalogError(err.message || "목록을 불러오지 못했습니다.");
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog(token || "");
    return undefined;
  }, [token, refreshCatalog]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      invokeKioskPublic("notices", {}, token || "")
        .then((noticeList) => setNotices(Array.isArray(noticeList) ? noticeList : []))
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [token]);

  const handleUnlock = async (pin) => {
    if (unlocking) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      const data = await invokeKioskPublic("unlock", { device_pin: pin });
      saveToken(data.kiosk_token);
      setToken(data.kiosk_token);
      setUnlockPin("");
    } catch (err) {
      setUnlockError(err.message || "PIN이 올바르지 않습니다.");
      setUnlockPin("");
    } finally {
      setUnlocking(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (categoryId && it.category !== categoryId) return false;
      if (!q) return true;
      return String(it.name || "").toLowerCase().includes(q)
        || String(it.code || "").toLowerCase().includes(q);
    });
  }, [items, search, categoryId]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter((t) => {
      if (!q) return true;
      return String(t.name || "").toLowerCase().includes(q);
    });
  }, [teachers, teacherSearch]);

  const homeTeacherMatches = useMemo(() => {
    const q = homeTeacherQuery.trim().toLowerCase();
    if (!q) return [];
    return teachers.filter((t) => String(t.name || "").toLowerCase().includes(q));
  }, [teachers, homeTeacherQuery]);

  const startRent = () => {
    if (!teacherSession || !sessionTeacher) {
      openQrLogin();
      return;
    }
    resetWizard();
    setSelectedTeacher(sessionTeacher);
    setMode("rent");
  };

  const startReturn = () => {
    if (!teacherSession || !sessionTeacher) {
      openQrLogin();
      return;
    }
    resetWizard();
    setSelectedTeacher(sessionTeacher);
    setMode("return");
    setStep("pick");
    setBusy(true);
    invokeKioskPublic("holdings", {
      teacher_id: sessionTeacher.id,
      teacher_session: teacherSession,
    }, token).then((data) => {
      setHoldings(data.holdings || []);
      setPendingReturns(data.pending_returns || []);
      if (!(data.holdings || []).length && !(data.pending_returns || []).length) setFlowError("반납할 교구가 없습니다.");
    }).catch((err) => setFlowError(err.message || "보유 교구를 불러오지 못했습니다."))
      .finally(() => setBusy(false));
  };

  const startBrowse = () => {
    resetWizard();
    setMode("browse");
  };

  const startWeekGear = () => {
    if (!teacherSession || !sessionTeacher) {
      openQrLogin();
      return;
    }
    resetWizard();
    openWeekGearForTeacher(sessionTeacher, true);
  };

  const startYear = schoolYearStartYear();

  const monthGear = useMemo(() => {
    if (!weekGearExtras || !selectedTeacher) return null;
    return buildMonthGearSections({
      ...weekGearExtras,
      yearMonth: viewMonth,
    });
  }, [weekGearExtras, selectedTeacher, viewMonth]);

  const prevMonth = prevSchoolYearMonth(viewMonth, startYear);
  const nextMonth = nextSchoolYearMonth(viewMonth, startYear);

  const openWeekGearForTeacher = async (teacher, fromHome = false) => {
    if (!teacher || busy) return;
    setBusy(true);
    setFlowError("");
    setSelectedTeacher(teacher);
    setWeekGearExtras(null);
    setWeekFromHome(fromHome);
    setMode("week");
    setStep("list");
    // 검색어는 유지 (선생님이 누구인지 홈에서 다시 볼 수 있게)
    try {
      const data = await invokeKioskPublic("teacher_week_gear", {
        teacher_id: teacher.id,
        teacher_session: teacherSession,
      }, token);
      const me = { id: data.teacher.id, name: data.teacher.name };
      const schedules = resolveRotationSchedules(
        data.schedules || [],
        me,
        startYear,
      );
      const extras = {
        schedules,
        weeklyLists: data.weeklyLists || [],
        monthWeeks: data.monthWeeks || [],
        items: data.items || [],
        me,
      };
      const currentSlot = findCurrentRotationWeekSlot(extras.monthWeeks);
      const initialMonth = clampToSchoolYear(
        currentSlot
          ? String(currentSlot.year_month).slice(0, 7)
          : yearMonthKey(),
        startYear,
      );
      setWeekGearExtras(extras);
      setViewMonth(initialMonth);
      if (fromHome && teacher.name) {
        setHomeTeacherQuery(teacher.name);
      }
    } catch (err) {
      if (err instanceof KioskError && (err.code === "DEVICE_LOCKED" || err.status === 401)) {
        saveToken("");
        setToken("");
      }
      setFlowError(err.message || "배정 교구를 불러오지 못했습니다.");
      if (fromHome) {
        setMode("home");
        setStep("pick");
      } else {
        setStep("teacher");
      }
    } finally {
      setBusy(false);
    }
  };

  const shiftViewMonth = (dir) => {
    const next = dir < 0
      ? prevSchoolYearMonth(viewMonth, startYear)
      : nextSchoolYearMonth(viewMonth, startYear);
    if (next) setViewMonth(next);
  };

  const loadWeekGearForTeacher = (teacher) => openWeekGearForTeacher(teacher, false);

  const addToCart = (item, addQty = 1) => {
    if (!item?.id) return false;
    if (item.available <= 0) {
      setFlowError("재고가 없습니다.");
      return false;
    }
    setFlowError("");
    setCart((prev) => {
      const found = prev.find((c) => c.id === item.id);
      if (found) {
        const nextQty = Math.min(item.available, found.quantity + addQty);
        return prev.map((c) => (
          c.id === item.id
            ? { ...c, quantity: nextQty, available: item.available, name: item.name, photo_url: item.photo_url }
            : c
        ));
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          code: item.code,
          photo_url: item.photo_url,
          available: item.available,
          quantity: Math.min(addQty, item.available),
        },
      ];
    });
    return true;
  };

  const setCartQuantity = (itemId, nextQty) => {
    setCart((prev) => prev
      .map((c) => {
        if (c.id !== itemId) return c;
        const q = Math.max(0, Math.min(c.available, Math.floor(Number(nextQty) || 0)));
        return { ...c, quantity: q };
      })
      .filter((c) => c.quantity > 0));
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((c) => c.id !== itemId));
  };

  /** 이번달 교구 → 대여: PIN 없이 장바구니 담기 */
  const startRentFromWeek = () => {
    if (!selectedTeacher) return;
    setSelectedItem(null);
    setTeacherPin("");
    setFlowError("");
    pinSubmitting.current = false;
    setRentFromWeek(true);
    setMode("rent");
    setStep("pick");
  };

  const startRentWeekItem = (row) => {
    if (!row?.item_id || !selectedTeacher) {
      setFlowError("이 교구는 목록에 매칭되지 않아 바로 담을 수 없습니다. 대여하기에서 선택해 주세요.");
      return;
    }
    const catalogItem = items.find((it) => it.id === row.item_id);
    if (!catalogItem) {
      setFlowError("재고 목록에서 교구를 찾지 못했습니다.");
      return;
    }
    setTeacherPin("");
    setFlowError("");
    pinSubmitting.current = false;
    setRentFromWeek(true);
    if (cart.some((c) => c.id === catalogItem.id)) {
      removeFromCart(catalogItem.id);
      setToastMsg("선택 해제했어요");
      return;
    }
    if (catalogItem.available <= 0) {
      setFlowError("재고가 없습니다.");
      return;
    }
    if (addToCartWithGuideCheck(catalogItem, 1)) {
      setToastMsg("장바구니에 담겼어요!");
    }
  };

  const returnToWeekList = () => {
    setMode("week");
    setStep("list");
    setSelectedItem(null);
    setTeacherPin("");
    setRentFromWeek(false);
    setFlowError("");
    pinSubmitting.current = false;
  };

  const pickItemForRent = (item) => {
    if (!item?.id) return;
    if (cart.some((c) => c.id === item.id)) {
      removeFromCart(item.id);
      setFlowError("");
      setToastMsg("선택 해제했어요");
      return;
    }
    if (addToCartWithGuideCheck(item, 1)) {
      setToastMsg("장바구니에 담겼어요!");
    }
  };

  const goRentCart = () => {
    if (!cart.length) {
      setFlowError("장바구니에 교구를 담아 주세요.");
      return;
    }
    setFlowError("");
    setStep("cart");
  };

  const goRentTeacherOrPin = () => {
    if (!cart.length) {
      setFlowError("장바구니가 비어 있습니다.");
      return;
    }
    setFlowError("");
    if (teacherSession && selectedTeacher) {
      submitRentBatch("");
      return;
    }
    setStep("teacher");
  };

  const submitRentBatch = async (pin, options = {}) => {
    if (pinSubmitting.current || busy || !selectedTeacher || !cart.length) return;
    const force = Boolean(options.force);
    const reason = String(options.reason ?? conflictReason ?? "").trim();

    if (!force && !conflictAckRef.current) {
      const conflicts = findKioskRentConflicts(rotationGuides, cart, selectedTeacher.id);
      if (conflicts.length) {
        setConflictReason("");
        setConflictModal({ conflicts, pin });
        return;
      }
    }

    pinSubmitting.current = true;
    setBusy(true);
    setFlowError("");
    try {
      const conflicts = findKioskRentConflicts(rotationGuides, cart, selectedTeacher.id);
      const data = await invokeKioskPublic("rent_batch", {
        teacher_id: selectedTeacher.id,
        teacher_pin: pin,
        teacher_session: teacherSession,
        location: "사무실",
        items: cart.map((c) => ({ item_id: c.id, quantity: c.quantity })),
        conflict_reason: reason,
        conflict_assignee_ids: force || conflictAckRef.current
          ? [...new Set(conflicts.map((c) => c.teacherId))]
          : [],
        conflict_item_names: force || conflictAckRef.current
          ? [...new Set(conflicts.map((c) => c.itemName))]
          : [],
      }, token);
      setSuccessMsg({
        title: "대여 신청 완료!",
        detail: `${selectedTeacher.name} · ${data.summary || data.item_name}\n관리자 승인 후 대여가 확정됩니다.`,
      });
      setMode("success");
      setCart([]);
      setConflictModal(null);
      setConflictReason("");
      conflictAckRef.current = false;
      refreshCatalog(token);
    } catch (err) {
      setFlowError(err.message || "대여에 실패했습니다.");
      setTeacherPin("");
      pinSubmitting.current = false;
      conflictAckRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  const loadHoldingsThenPick = async (pin) => {
    if (pinSubmitting.current || busy || !selectedTeacher) return;
    pinSubmitting.current = true;
    setBusy(true);
    setFlowError("");
    try {
      const data = await invokeKioskPublic("holdings", {
        teacher_id: selectedTeacher.id,
        teacher_pin: pin,
        teacher_session: teacherSession,
      }, token);
      setHoldings(data.holdings || []);
      setPendingReturns(data.pending_returns || []);
      setReturnCart({});
      setTeacherPin(pin);
      setStep("pick");
      pinSubmitting.current = false;
      if (!(data.holdings || []).length && !(data.pending_returns || []).length) {
        setFlowError("반납할 교구가 없습니다.");
      }
    } catch (err) {
      setFlowError(err.message || "조회에 실패했습니다.");
      setTeacherPin("");
      pinSubmitting.current = false;
    } finally {
      setBusy(false);
    }
  };

  const refreshHoldings = async () => {
    if (!selectedTeacher || (!teacherPin && !teacherSession)) return;
    const data = await invokeKioskPublic("holdings", {
      teacher_id: selectedTeacher.id,
      teacher_pin: teacherPin,
      teacher_session: teacherSession,
    }, token);
    setHoldings(data.holdings || []);
    setPendingReturns(data.pending_returns || []);
  };

  const cancelPendingReturn = async (ret) => {
    if (busy || !selectedTeacher || (!teacherPin && !teacherSession) || !ret?.id) return;
    setBusy(true);
    setFlowError("");
    try {
      await invokeKioskPublic("cancel_return", {
        teacher_id: selectedTeacher.id,
        teacher_pin: teacherPin,
        teacher_session: teacherSession,
        return_id: ret.id,
      }, token);
      await refreshHoldings();
      setToastMsg(`${ret.name || "교구"} 반납을 취소했어요`);
    } catch (err) {
      setFlowError(err.message || "반납 취소에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const submitExtendSelected = async () => {
    const itemIds = Object.keys(returnCart);
    if (busy || !selectedTeacher || (!teacherPin && !teacherSession) || !itemIds.length) {
      if (!itemIds.length) setFlowError("다시 대여할 교구를 선택해 주세요.");
      return;
    }
    for (const itemId of itemIds) {
      const others = rotationGuidesForItem(rotationGuides, itemId)
        .filter((g) => g.teacher_id && g.teacher_id !== selectedTeacher.id);
      if (others.length) {
        const h = holdings.find((x) => x.item_id === itemId);
        const g = others[0];
        setFlowError(
          `${h?.name || "교구"}은(는) ${g.teacher_name}님의 ${g.relative_week} 정규수업 교구라 다시 대여할 수 없습니다.`,
        );
        return;
      }
    }
    setBusy(true);
    setFlowError("");
    try {
      const data = await invokeKioskPublic("extend", {
        teacher_id: selectedTeacher.id,
        teacher_pin: teacherPin,
        teacher_session: teacherSession,
        item_ids: itemIds,
        weeks: 1,
      }, token);
      setReturnCart({});
      await refreshHoldings();
      const names = (data.item_names || []).join(", ");
      setMode("success");
      setSuccessMsg({
        title: "다시 대여 완료",
        detail: `${names || "교구"} 반납예정일을 ${data.weeks || 1}주 연장했어요.`,
      });
    } catch (err) {
      setFlowError(err.message || "다시 대여에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const toggleReturnItem = (h) => {
    setReturnCart((prev) => {
      if (prev[h.item_id]) {
        const next = { ...prev };
        delete next[h.item_id];
        return next;
      }
      return { ...prev, [h.item_id]: 1 };
    });
    setFlowError("");
  };

  const setReturnQuantity = (itemId, nextQty, maxQty) => {
    const q = Math.max(1, Math.min(maxQty, Math.floor(Number(nextQty) || 1)));
    setReturnCart((prev) => {
      if (!prev[itemId]) return prev;
      return { ...prev, [itemId]: q };
    });
  };

  const returnSelectedCount = useMemo(
    () => Object.values(returnCart).reduce((s, q) => s + Number(q || 0), 0),
    [returnCart],
  );

  const submitReturnBatch = async () => {
    const entries = holdings
      .filter((h) => returnCart[h.item_id])
      .map((h) => ({
        item_id: h.item_id,
        name: h.name,
        quantity: Math.min(returnCart[h.item_id], h.returnable),
      }))
      .filter((e) => e.quantity > 0);
    if (busy || !selectedTeacher || (!teacherPin && !teacherSession) || !entries.length) {
      if (!entries.length) setFlowError("반납할 교구를 선택해 주세요.");
      return;
    }
    setBusy(true);
    setFlowError("");
    try {
      const results = [];
      for (const entry of entries) {
        const data = await invokeKioskPublic("return", {
          teacher_id: selectedTeacher.id,
          teacher_pin: teacherPin,
          teacher_session: teacherSession,
          item_id: entry.item_id,
          quantity: entry.quantity,
          location: "사무실",
        }, token);
        results.push(`${data.item_name || entry.name} ${data.quantity || entry.quantity}개`);
      }
      setSuccessMsg({
        title: "반납 신청 완료!",
        detail: `${selectedTeacher.name} · ${results.join(", ")}\n관리자 승인 후 반납이 확정됩니다.`,
      });
      setMode("success");
      setReturnCart({});
      refreshCatalog(token);
    } catch (err) {
      setFlowError(err.message || "반납에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // ── Success ──
  if (mode === "success") {
    return (
      <div className="kiosk-page">
        <main className="kiosk-main kiosk-main--center">
          <SuccessScreen
            title={successMsg.title}
            detail={successMsg.detail}
            onDone={goHome}
          />
        </main>
      </div>
    );
  }

  const showBack = mode !== "home";
  const screenTitle = (() => {
    if (mode === "home") return "";
    if (mode === "browse") return "교구 둘러보기";
    if (mode === "rent" && step === "pick") {
      return selectedTeacher ? `${selectedTeacher.name} · 교구 담기` : "교구 담기";
    }
    if (mode === "rent" && step === "cart") return "장바구니";
    if (mode === "return" && step === "pick") {
      return selectedTeacher ? `${selectedTeacher.name} · 반납` : "반납할 교구";
    }
    if (mode === "week" && step === "teacher") return "선생님 선택";
    if (mode === "week" && step === "list") {
      return selectedTeacher ? `${selectedTeacher.name} · 이번달 내 교구` : "이번달 교구";
    }
    return "";
  })();

  return (
    <div className="kiosk-page">
      {toastMsg ? (
        <div className="kiosk-toast" role="status" aria-live="polite">
          <ShoppingBag size={20} strokeWidth={2.2} aria-hidden />
          {toastMsg}
        </div>
      ) : null}
      {conflictModal ? (
        <RotationConflictModal
          conflicts={conflictModal.conflicts}
          reason={conflictReason}
          onReasonChange={setConflictReason}
          busy={busy}
          onCancel={() => {
            setConflictModal(null);
            setConflictReason("");
            conflictAckRef.current = false;
            setTeacherPin("");
            pinSubmitting.current = false;
          }}
          onConfirm={() => {
            const pin = conflictModal.pin;
            conflictAckRef.current = true;
            setConflictModal(null);
            submitRentBatch(pin, { force: true, reason: conflictReason });
          }}
        />
      ) : null}
      {guideConfirm ? (
        <RegularClassAddConfirmModal
          guide={guideConfirm.guide}
          itemName={guideConfirm.item?.name}
          onCancel={() => setGuideConfirm(null)}
          onConfirm={() => {
            const { item, quantity } = guideConfirm;
            setGuideConfirm(null);
            if (addToCart(item, quantity)) {
              setToastMsg("장바구니에 담겼어요!");
            }
          }}
        />
      ) : null}
      {qrOpen ? (
        <QrLoginModal
          pair={qrPair}
          error={qrError}
          onClose={() => { setQrOpen(false); setQrPair(null); setQrError(""); }}
          onRetry={openQrLogin}
        />
      ) : null}
      <header className={`kiosk-top${showBack ? " kiosk-top--nav" : ""}`}>
        <div className="kiosk-top-left">
          {showBack ? (
            <button
              type="button"
              className="kiosk-back"
              onClick={() => {
                if (mode === "browse") goHome();
                else if (mode === "week" && step === "list") {
                  if (weekFromHome) {
                    setWeekGearExtras(null);
                    setMode("home");
                    setStep("pick");
                    setFlowError("");
                  } else {
                    setWeekGearExtras(null);
                    setSelectedTeacher(null);
                    setStep("teacher");
                  }
                } else if (mode === "week" && step === "teacher") goHome();
                else if (rentFromWeek && mode === "rent" && (step === "pick" || step === "cart" || step === "pin" || step === "teacher")) {
                  returnToWeekList();
                }
                else if (mode === "rent" && step === "pick") goHome();
                else if (mode === "rent" && step === "cart") setStep("pick");
                else if (mode === "rent" && step === "teacher") setStep("cart");
                else if (mode === "rent" && step === "pin") {
                  setStep(rentFromWeek && selectedTeacher ? "cart" : "teacher");
                }
                else if (mode === "return") goHome();
                else goHome();
              }}
              aria-label="뒤로"
            >
              <ArrowLeft size={22} /> 뒤로
            </button>
          ) : (
            <div className="kiosk-brand"><strong>GTS</strong><span>키오스크</span></div>
          )}
        </div>
        {showBack && screenTitle ? (
          <div className="kiosk-top-title" aria-live="polite">{screenTitle}</div>
        ) : null}
        <div className="kiosk-top-right">
          {showBack && sessionTeacher ? (
            <div className="kiosk-top-session-time" aria-label={`로그인 남은 시간 ${sessionTimeLabel}`}>
              <span>남은 시간 <b>{sessionTimeLabel}</b></span>
              <button type="button" onClick={extendTeacherSession}>10분 연장</button>
            </div>
          ) : !showBack && sessionTeacher ? (
            <button type="button" className="kiosk-session-user" onClick={endTeacherSession} aria-label="QR 로그인 사용 종료">
              <UserRound size={19} strokeWidth={2.1} />
              <span>{sessionTeacher.name} 선생님</span><em>· 사용 중</em>
            </button>
          ) : (
            <button type="button" className="kiosk-qr-login-button" onClick={openQrLogin} aria-label="휴대폰 QR 로그인">
              QR 로그인
            </button>
          )}
          {isFullscreen ? (
            <button type="button" className="kiosk-fs kiosk-fs--exit" onClick={exitFullscreen} aria-label="전체화면 종료">
              <Minimize2 size={18} /> 닫기
            </button>
          ) : showFsBtn ? (
            <button type="button" className="kiosk-fs" onClick={enterFullscreen} aria-label="전체화면">
              <Maximize2 size={18} /> 전체화면
            </button>
          ) : null}
        </div>
      </header>

      <main className="kiosk-main">
        {catalogError ? (
          <div className="kiosk-banner-error">
            {catalogError}
            <button type="button" onClick={() => refreshCatalog(token)}>다시 시도</button>
          </div>
        ) : null}

        {mode === "home" ? (
          <div className="kiosk-home">
            <KioskNoticeSlider notices={notices} />

            <div className="kiosk-home-grid kiosk-home-grid--main">
              <button type="button" className="kiosk-home-card kiosk-home-card--week" onClick={startWeekGear}>
                <CalendarDays size={64} strokeWidth={1.55} />
                <strong>이번달 내 교구</strong>
                <span>이번달 내 교구를 확인할 수 있어요.</span>
                <i><ChevronRight size={22} /></i>
              </button>
              <button type="button" className="kiosk-home-card kiosk-home-card--rent" onClick={startRent}>
                <ShoppingBag size={64} strokeWidth={1.55} />
                <strong>대여하기</strong>
                <span>필요한 교구를 찾아 대여할 수 있어요.</span>
                <i><ChevronRight size={22} /></i>
              </button>
              <button type="button" className="kiosk-home-card kiosk-home-card--return" onClick={startReturn}>
                <RotateCcw size={64} strokeWidth={1.55} />
                <strong>반납하기</strong>
                <span>대여한 교구를 확인하고 반납할 수 있어요.</span>
                <i><ChevronRight size={22} /></i>
              </button>
            </div>

            <div className={`kiosk-home-login-state${sessionTeacher ? " is-signed-in" : ""}`}>
              {sessionTeacher ? (
                <>
                  <div className="kiosk-home-session-person"><UserRound size={21} /><strong>{sessionTeacher.name} 선생님 로그인 중</strong></div>
                  <div className="kiosk-home-session-time"><span>남은 시간 <b>{sessionTimeLabel}</b></span><button type="button" onClick={extendTeacherSession}>10분 연장</button></div>
                </>
              ) : (
                <><strong>대여와 반납은 휴대폰 로그인이 필요합니다.</strong><span>오른쪽 위 QR 로그인 버튼을 눌러 본인 계정으로 승인해 주세요.</span></>
              )}
            </div>
            {flowError && mode === "home" ? <p className="kiosk-error">{flowError}</p> : null}
            {loadingCatalog ? <p className="kiosk-muted">목록 불러오는 중...</p> : null}
          </div>
        ) : null}

        {(mode === "browse" || (mode === "rent" && step === "pick")) ? (
          <div className={`kiosk-browse kiosk-browse--equipment${mode === "rent" && cart.length ? " kiosk-browse--with-cart" : ""}`}>
            {ItemsBrowsePage ? (
              <GearCategoriesProvider>
                <ItemsBrowsePage
                  me={browseMe}
                  items={browseItems}
                  itemSets={[]}
                  ris={[]}
                  rets={[]}
                  reqs={[]}
                  cart={browseCart}
                  setCart={setBrowseCart}
                  reservations={[]}
                  teachers={teachers}
                  regularClassGuideByItem={mode === "rent" ? regularClassGuideByItem : new Map()}
                  kioskMode
                  readOnly={mode === "browse"}
                  onOpenCart={mode === "rent" ? goRentCart : undefined}
                  onDetail={() => {}}
                  onSetDetail={() => {}}
                />
              </GearCategoriesProvider>
            ) : (
              <p className="kiosk-muted">교구 둘러보기 화면을 불러오는 중...</p>
            )}
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
          </div>
        ) : null}

        {mode === "rent" && step === "cart" ? (
          <div className="kiosk-panel kiosk-panel--wide kiosk-panel--cart">
            {rentFromWeek && selectedTeacher ? (
              <p className="kiosk-week-meta">{selectedTeacher.name}님 · PIN은 대여 확정 시에만 입력합니다</p>
            ) : null}
            <div className="kiosk-cart-list">
              {cart.map((c) => (
                <div key={c.id} className="kiosk-cart-row">
                  <div className="kiosk-cart-thumb">
                    {c.photo_url ? <img src={c.photo_url} alt="" /> : <Package size={28} />}
                  </div>
                  <div className="kiosk-cart-body">
                    <div className="kiosk-cart-name">{c.name || "이름 없음"}</div>
                    <div className="kiosk-cart-meta">{c.code} · 가능 {c.available}개</div>
                    <QtyStepper
                      value={c.quantity}
                      min={1}
                      max={Math.max(1, c.available)}
                      onChange={(n) => setCartQuantity(c.id, n)}
                    />
                  </div>
                  <button type="button" className="kiosk-cart-remove" onClick={() => removeFromCart(c.id)} aria-label="삭제">
                    삭제
                  </button>
                </div>
              ))}
              {!cart.length ? <p className="kiosk-muted">장바구니가 비어 있습니다.</p> : null}
            </div>
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
            <button
              type="button"
              className="kiosk-btn kiosk-btn--primary"
              disabled={!cart.length}
              onClick={goRentTeacherOrPin}
            >
              다음
            </button>
          </div>
        ) : null}

        {((mode === "rent" && step === "teacher") || (mode === "week" && step === "teacher")) ? (
          <div className="kiosk-panel kiosk-panel--fill">
            {mode === "week" ? (
              <p className="kiosk-week-meta">이름을 선택하면 이번달 배정 교구가 바로 표시됩니다.</p>
            ) : null}
            <div className="kiosk-search-wrap">
              <Search size={20} aria-hidden />
              <input
                className="kiosk-search"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="이름 검색"
                aria-label="선생님 이름 검색"
              />
            </div>
            <div className="kiosk-teacher-list">
              {filteredTeachers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`kiosk-teacher${selectedTeacher?.id === t.id ? " active" : ""}`}
                  onClick={() => {
                    if (mode === "week") {
                      loadWeekGearForTeacher(t);
                      return;
                    }
                    setSelectedTeacher(t);
                    setTeacherPin("");
                    setFlowError("");
                    setStep("pin");
                  }}
                >
                  {t.name}
                  {mode !== "week" && !t.has_kiosk_pin ? (
                    <span className="kiosk-teacher-warn">PIN 미설정</span>
                  ) : null}
                </button>
              ))}
            </div>
            {busy && mode === "week" ? <p className="kiosk-muted">배정 교구 불러오는 중...</p> : null}
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
          </div>
        ) : null}

        {mode === "week" && step === "list" && selectedTeacher ? (
          <div className="kiosk-browse kiosk-browse--month">
            <div className="kiosk-month-header">
              {cart.length ? (
                <button
                  type="button"
                  className="kiosk-month-cart-badge"
                  onClick={() => {
                    setRentFromWeek(true);
                    setMode("rent");
                    setStep("cart");
                  }}
                >
                  <ShoppingBag size={18} />
                  장바구니 {cart.length}종 · {cartCount}개
                </button>
              ) : null}
              <div className="kiosk-month-nav" role="group" aria-label="월 이동">
                <button
                  type="button"
                  className="kiosk-month-nav-btn"
                  disabled={!prevMonth}
                  onClick={() => shiftViewMonth(-1)}
                >
                  ◀ 이전달
                </button>
                <div className="kiosk-month-nav-label">
                  <strong>{monthLabel(viewMonth)}</strong>
                  {monthGear?.letter ? (
                    <span>
                      {" "}
                      · <em>{monthGear.letter}조</em>
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="kiosk-month-nav-btn"
                  disabled={!nextMonth}
                  onClick={() => shiftViewMonth(1)}
                >
                  다음달 ▶
                </button>
              </div>
            </div>

            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
            {busy ? <p className="kiosk-muted">배정 교구 불러오는 중...</p> : null}

            <div
              className={[
                "kiosk-week-grid",
                `kiosk-week-grid--n${Math.min(5, Math.max(1, (monthGear?.weeks || []).length || 1))}`,
                ((monthGear?.weeks || []).length % 2 === 1) ? "kiosk-week-grid--odd" : "",
              ].filter(Boolean).join(" ")}
            >
              {(monthGear?.weeks || []).map((week) => {
                const nextWeek = relativeGuideWeekTagLocal(week.weekStart, week.weekEnd) === "다음주";
                const thisWeek = relativeGuideWeekTagLocal(week.weekStart, week.weekEnd) === "이번주";
                return (
                <div
                  key={`w-${week.weekNumber}`}
                  className={[
                    "kiosk-month-week-card",
                    nextWeek ? "is-next-week" : "",
                    thisWeek ? "is-this-week" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <div className="kiosk-month-week-head">
                    <strong>
                      {week.weekLabel || `${week.weekNumber}주차`}
                      {nextWeek ? <span className="kiosk-week-tag kiosk-week-tag--next">다음주</span> : null}
                      {thisWeek ? <span className="kiosk-week-tag kiosk-week-tag--this">이번주</span> : null}
                    </strong>
                    {week.dateRange ? <span>{week.dateRange}</span> : null}
                  </div>
                  <div className="kiosk-month-week-items">
                    {week.rows.map((row) => {
                      const clickable = Boolean(row.item_id);
                      const inCartQty = row.item_id ? cartQtyById[row.item_id] : 0;
                      const RowTag = clickable ? "button" : "div";
                      return (
                        <RowTag
                          key={`${week.weekNumber}-${row.sheet_name}-${row.item_id || "x"}`}
                          type={clickable ? "button" : undefined}
                          className={`kiosk-week-chip${clickable ? " kiosk-week-chip--action" : ""}${inCartQty ? " in-cart" : ""}`}
                          onClick={clickable ? () => startRentWeekItem(row) : undefined}
                        >
                          <span className="kiosk-week-chip-thumb">
                            {row.photo_url ? (
                              <img src={row.photo_url} alt="" />
                            ) : (
                              <Package size={22} strokeWidth={1.5} />
                            )}
                          </span>
                          <span className="kiosk-week-chip-text">
                            <span className="kiosk-week-chip-name">{row.display_name}</span>
                            {inCartQty ? (
                              <span className="kiosk-item-cart-badge">담김 {inCartQty}</span>
                            ) : null}
                          </span>
                        </RowTag>
                      );
                    })}
                    {!week.rows.length ? (
                      <p className="kiosk-muted">배정 없음</p>
                    ) : null}
                  </div>
                </div>
                );
              })}
              {(monthGear?.weeks || []).length >= 5 ? (
                <button
                  type="button"
                  className={`kiosk-month-week-card kiosk-month-hint-card${cart.length ? " has-cart" : ""}`}
                  onClick={() => {
                    if (!cart.length) return;
                    setRentFromWeek(true);
                    setMode("rent");
                    setStep("cart");
                  }}
                  aria-label={cart.length ? `장바구니 확인, ${cartCount}개` : "교구를 클릭하면 장바구니에 담깁니다"}
                >
                  <ShoppingBag size={36} strokeWidth={2.2} aria-hidden />
                  <p>{cart.length ? <>장바구니 확인<br />{cartCount}개 담김</> : <>교구를 클릭하면<br />장바구니에 담겨요</>}</p>
                </button>
              ) : null}
              {!busy && !(monthGear?.weeks || []).length ? (
                <p className="kiosk-muted kiosk-week-grid-empty">
                  {monthLabel(viewMonth)} 배정 교구가 없습니다. 순환 스케줄을 확인해 주세요.
                </p>
              ) : null}
            </div>
            <div className="kiosk-week-actions">
              <button
                type="button"
                className="kiosk-btn kiosk-btn--primary"
                onClick={() => {
                  if (cart.length) {
                    setRentFromWeek(true);
                    setMode("rent");
                    setStep("cart");
                    return;
                  }
                  startRentFromWeek();
                }}
              >
                {cart.length ? `장바구니 확인 (${cartCount}개)` : "대여하기 (장바구니)"}
              </button>
            </div>
          </div>
        ) : null}

        {(mode === "rent" && step === "pin") && selectedTeacher ? (
          <div className="kiosk-panel kiosk-panel--center">
            <PinPad
              value={teacherPin}
              onChange={setTeacherPin}
              onSubmit={mode === "rent" ? submitRentBatch : loadHoldingsThenPick}
              disabled={busy}
              title={`${selectedTeacher.name}님 PIN`}
              subtitle={
                mode === "rent"
                  ? `장바구니 ${cart.length}종 · 총 ${cartCount}개 대여 확정`
                  : "본인 확인용 4자리 PIN을 입력하세요"
              }
            />
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
            {busy ? <p className="kiosk-muted">처리 중...</p> : null}
          </div>
        ) : null}

        {mode === "return" && step === "pick" ? (
          <div className="kiosk-panel kiosk-panel--wide kiosk-panel--return">
            <div className="kiosk-return-header">
              <p className="kiosk-week-meta kiosk-return-meta">
                <strong>{selectedTeacher?.name}</strong>님 보유 · 반납
              </p>
              <p className="kiosk-return-hint">여러 교구를 체크한 뒤 반납하거나, 다시 대여(1주 연장)할 수 있어요.</p>
            </div>
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}

            {pendingReturns.length ? (
              <div className="kiosk-pending-returns">
                <h3 className="kiosk-section-title">반납 승인 대기</h3>
                <div className="kiosk-pending-list">
                  {pendingReturns.map((ret) => (
                    <div key={ret.id} className="kiosk-pending-row">
                      <div className="kiosk-cart-thumb">
                        {ret.photo_url ? <img src={ret.photo_url} alt="" /> : <Package size={28} />}
                      </div>
                      <div className="kiosk-cart-body">
                        <div className="kiosk-cart-name">{ret.name}</div>
                        <div className="kiosk-cart-meta">
                          {ret.code} · {ret.quantity}개 · 승인 대기
                        </div>
                      </div>
                      <button
                        type="button"
                        className="kiosk-btn kiosk-btn--ghost kiosk-btn--sm"
                        disabled={busy}
                        onClick={() => cancelPendingReturn(ret)}
                      >
                        반납 취소
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <h3 className="kiosk-section-title">보유 교구 (반납 가능)</h3>
            <div className="kiosk-return-list" role="list">
              {holdings.map((h) => {
                const selectedQty = returnCart[h.item_id];
                const selected = Boolean(selectedQty);
                const blocked = rotationGuidesForItem(rotationGuides, h.item_id)
                  .some((g) => g.teacher_id && selectedTeacher && g.teacher_id !== selectedTeacher.id);
                return (
                  <div
                    key={h.item_id}
                    className={`kiosk-return-row${selected ? " is-selected" : ""}`}
                    role="listitem"
                  >
                    <label className="kiosk-return-row-main">
                      <input
                        type="checkbox"
                        className="kiosk-return-checkbox"
                        checked={selected}
                        onChange={() => toggleReturnItem(h)}
                        aria-label={`${h.name} 선택`}
                      />
                      <div className="kiosk-cart-thumb">
                        {h.photo_url ? <img src={h.photo_url} alt="" /> : <Package size={28} />}
                      </div>
                      <div className="kiosk-cart-body">
                        <div className="kiosk-cart-name">{h.name}</div>
                        <div className="kiosk-cart-meta">{h.code} · 반납 가능 {h.returnable}개</div>
                        {blocked ? (
                          <div className="kiosk-return-block-note">다른 선생님 정규수업 교구 · 다시 대여 불가</div>
                        ) : null}
                      </div>
                    </label>
                    {selected ? (
                      <div
                        className="kiosk-return-qty"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <span className="kiosk-return-qty-label">반납 수량</span>
                        <QtyStepper
                          value={selectedQty}
                          min={1}
                          max={Math.max(1, h.returnable)}
                          onChange={(n) => setReturnQuantity(h.item_id, n, h.returnable)}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!holdings.length ? <p className="kiosk-muted">반납 가능한 교구가 없습니다.</p> : null}
            </div>
            <div className="kiosk-return-footer kiosk-return-footer--double">
              <button
                type="button"
                className="kiosk-btn kiosk-btn--secondary"
                disabled={busy || !returnSelectedCount}
                onClick={submitExtendSelected}
              >
                {busy ? "처리 중..." : `다시 대여하기${returnSelectedCount ? ` (${Object.keys(returnCart).length}종)` : ""}`}
              </button>
              <button
                type="button"
                className="kiosk-btn kiosk-btn--return"
                disabled={busy || !returnSelectedCount}
                onClick={submitReturnBatch}
              >
                {busy
                  ? "처리 중..."
                  : returnSelectedCount
                    ? `반납 완료 (${Object.keys(returnCart).length}종 · ${returnSelectedCount}개)`
                    : "반납할 교구를 선택하세요"}
              </button>
            </div>
          </div>
        ) : null}
      </main>
      {mode === "rent" && step === "pick" && cart.length ? (
        <button
          type="button"
          className="kiosk-floating-cart"
          onClick={goRentCart}
          aria-label={`장바구니 확인, ${cart.length}종 총 ${cartCount}개`}
        >
          <span className="kiosk-floating-cart__icon"><ShoppingBag size={25} strokeWidth={2.2} /></span>
          <span className="kiosk-floating-cart__text">장바구니</span>
          <strong>{cartCount}</strong>
        </button>
      ) : null}
    </div>
  );
}
