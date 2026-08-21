import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Megaphone,
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

function rotationGuidesForItem(guidesByItem, itemId) {
  if (!itemId || !guidesByItem) return [];
  const list = guidesByItem[itemId] || guidesByItem[String(itemId)] || [];
  return Array.isArray(list) ? list : [];
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

function RotationGuideLines({ guides }) {
  const lines = (guides || []).slice(0, 2);
  if (!lines.length) return null;
  return (
    <div className="kiosk-rotation-guides">
      {lines.map((g) => (
        <div key={`${g.teacher_id}-${g.week_start}-${g.label}`} className="kiosk-rotation-guide">
          {g.label || `${formatKoMonthDay(g.until_ymd)}까지 ${g.teacher_name} 정규수업`}
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

  useEffect(() => {
    if (list.length <= 1) return undefined;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % list.length);
    }, 5500);
    return () => window.clearInterval(t);
  }, [list.length]);

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
    <div className={`kiosk-notice-slider${urgent ? " is-urgent" : ""}${birthday ? " is-birthday" : ""}`} aria-live="polite">
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
              onClick={() => setIdx(i)}
              aria-label={`${i + 1}번째 공지`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ItemCard({ item, onSelect, inCart, cartQty, rotationGuides }) {
  return (
    <button type="button" className={`kiosk-item-card${inCart ? " in-cart" : ""}`} onClick={() => onSelect(item)}>
      <div className="kiosk-item-thumb">
        {item.photo_url ? (
          <img src={item.photo_url} alt="" />
        ) : (
          <Package size={36} strokeWidth={1.5} />
        )}
      </div>
      <div className="kiosk-item-body">
        <div className="kiosk-item-name">{item.name}</div>
        <div className="kiosk-item-meta">{item.code}</div>
        <div className={`kiosk-item-stock${item.available <= 0 ? " out" : ""}`}>
          남은 수량 {item.available}
        </div>
        <RotationGuideLines guides={rotationGuides} />
        {inCart ? (
          <div className="kiosk-item-cart-badge">장바구니 {cartQty}개</div>
        ) : null}
      </div>
    </button>
  );
}

export default function KioskApp() {
  const [token, setToken] = useState(loadToken);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

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
    if (!token) return undefined;
    refreshCatalog(token);
    return undefined;
  }, [token, refreshCatalog]);

  useEffect(() => {
    if (!token) return undefined;
    const timer = window.setInterval(() => {
      invokeKioskPublic("notices", {}, token)
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
    resetWizard();
    setMode("rent");
  };

  const startReturn = () => {
    resetWizard();
    setMode("return");
    setStep("teacher");
  };

  const startBrowse = () => {
    resetWizard();
    setMode("browse");
  };

  const startWeekGear = () => {
    resetWizard();
    setMode("week");
    setStep("teacher");
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
    if (addToCart(catalogItem, 1)) {
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
    if (addToCart(item, 1)) {
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
    if (rentFromWeek && selectedTeacher) {
      setTeacherPin("");
      setStep("pin");
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
      }, token);
      setHoldings(data.holdings || []);
      setTeacherPin(pin);
      setStep("pick");
      pinSubmitting.current = false;
      if (!(data.holdings || []).length) {
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

  const pickHolding = (h) => {
    setSelectedItem({
      id: h.item_id,
      name: h.name,
      code: h.code,
      photo_url: h.photo_url,
      available: h.returnable,
    });
    setQty(1);
    setStep("qty");
  };

  const submitReturn = async () => {
    if (busy || !selectedItem || !selectedTeacher || !teacherPin) return;
    setBusy(true);
    setFlowError("");
    try {
      const data = await invokeKioskPublic("return", {
        teacher_id: selectedTeacher.id,
        teacher_pin: teacherPin,
        item_id: selectedItem.id,
        quantity: qty,
        location,
      }, token);
      setSuccessMsg({
        title: "반납 신청 완료!",
        detail: `${selectedTeacher.name} · ${data.item_name} ${data.quantity}개\n관리자 승인 후 반납이 확정됩니다.`,
      });
      setMode("success");
      refreshCatalog(token);
    } catch (err) {
      setFlowError(err.message || "반납에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // ── Device unlock ──
  if (!token) {
    return (
      <div className="kiosk-page">
        <header className="kiosk-top">
          <div className="kiosk-top-left">
            <div className="kiosk-brand">GTS 키오스크</div>
          </div>
          <div className="kiosk-top-right">
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
        <main className="kiosk-main kiosk-main--center">
          <PinPad
            value={unlockPin}
            onChange={setUnlockPin}
            onSubmit={handleUnlock}
            disabled={unlocking}
            title="기기 PIN 입력"
            subtitle="키오스크 사용을 위해 4자리 공용 PIN을 입력하세요"
          />
          {unlockError ? <p className="kiosk-error">{unlockError}</p> : null}
          <KioskInstallHint />
        </main>
      </div>
    );
  }

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
    if (mode === "rent" && step === "teacher") return "누가 가져가세요?";
    if (mode === "rent" && step === "pin") return "PIN 입력";
    if (mode === "return" && step === "teacher") return "누가 반납하세요?";
    if (mode === "return" && step === "pin") return "PIN 입력";
    if (mode === "return" && step === "pick") return "반납할 교구";
    if (mode === "return" && step === "qty") return "반납 수량";
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
                else if (step === "teacher" && mode === "return") goHome();
                else if (step === "qty" && mode === "return") setStep("pick");
                else if (step === "pin" && mode === "return") setStep("teacher");
                else if (step === "pick" && mode === "return") setStep("pin");
                else goHome();
              }}
              aria-label="뒤로"
            >
              <ArrowLeft size={22} /> 뒤로
            </button>
          ) : (
            <div className="kiosk-brand">GTS 키오스크</div>
          )}
        </div>
        {showBack && screenTitle ? (
          <div className="kiosk-top-title" aria-live="polite">{screenTitle}</div>
        ) : null}
        <div className="kiosk-top-right">
          {mode === "week" && step === "list" ? (
            <button type="button" className="kiosk-home-top" onClick={goHome} aria-label="홈으로">
              홈으로
            </button>
          ) : null}
          <button type="button" className="kiosk-lock" onClick={lockDevice} aria-label="기기 잠금">
            잠금
          </button>
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

            <h1>무엇을 할까요?</h1>
            <div className="kiosk-home-grid kiosk-home-grid--main">
              <button type="button" className="kiosk-home-card kiosk-home-card--week" onClick={startWeekGear}>
                <CalendarDays size={64} strokeWidth={1.55} />
                <span>이번달 내 교구</span>
              </button>
              <button type="button" className="kiosk-home-card kiosk-home-card--rent" onClick={startRent}>
                <ShoppingBag size={64} strokeWidth={1.55} />
                <span>대여하기</span>
              </button>
              <button type="button" className="kiosk-home-card kiosk-home-card--return" onClick={startReturn}>
                <RotateCcw size={64} strokeWidth={1.55} />
                <span>반납하기</span>
              </button>
            </div>

            <div className="kiosk-home-search">
              <label className="kiosk-home-search-label" htmlFor="kiosk-home-teacher">
                이름으로 바로 조회
              </label>
              <div className="kiosk-search-wrap kiosk-search-wrap--hero">
                <Search size={24} aria-hidden />
                <input
                  id="kiosk-home-teacher"
                  className="kiosk-search kiosk-search--hero"
                  value={homeTeacherQuery}
                  onChange={(e) => setHomeTeacherQuery(e.target.value)}
                  placeholder="이름을 입력하세요"
                  aria-label="선생님 이름 검색"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {homeTeacherQuery.trim() ? (
                <div className="kiosk-home-matches" role="listbox" aria-label="선생님 검색 결과">
                  {homeTeacherMatches.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      className="kiosk-home-match"
                      onClick={() => openWeekGearForTeacher(t, true)}
                      disabled={busy}
                    >
                      {t.name}
                    </button>
                  ))}
                  {!homeTeacherMatches.length ? (
                    <p className="kiosk-muted">일치하는 선생님이 없습니다.</p>
                  ) : null}
                </div>
              ) : (
                <p className="kiosk-home-search-hint">이름을 고르면 이번달 배정 교구를 바로 확인합니다.</p>
              )}
              {busy && homeTeacherQuery.trim() ? (
                <p className="kiosk-muted">배정 교구 불러오는 중...</p>
              ) : null}
              {flowError && mode === "home" ? <p className="kiosk-error">{flowError}</p> : null}
            </div>
            {loadingCatalog ? <p className="kiosk-muted">목록 불러오는 중...</p> : null}
          </div>
        ) : null}

        {(mode === "browse" || (mode === "rent" && step === "pick")) ? (
          <div className={`kiosk-browse${mode === "rent" && cart.length ? " kiosk-browse--with-cart" : ""}`}>
            {mode === "rent" ? (
              <div className="kiosk-rent-toolbar">
                <p className="kiosk-rent-hint">교구를 누르면 장바구니에 담깁니다.</p>
                <button type="button" className="kiosk-inline-link" onClick={startBrowse}>
                  둘러보기만 하기
                </button>
              </div>
            ) : null}
            <div className="kiosk-search-wrap">
              <Search size={20} aria-hidden />
              <input
                className="kiosk-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="교구명 검색"
                aria-label="교구명 검색"
              />
            </div>
            <div className="kiosk-cats" role="listbox" aria-label="카테고리">
              <button
                type="button"
                className={`kiosk-cat${!categoryId ? " active" : ""}`}
                onClick={() => setCategoryId("")}
              >
                전체
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`kiosk-cat${categoryId === c.id ? " active" : ""}`}
                  style={{ "--cat-color": c.color }}
                  onClick={() => setCategoryId(c.id)}
                >
                  <span className="kiosk-cat-icon">{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="kiosk-item-grid">
              {filteredItems.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  inCart={Boolean(cartQtyById[it.id])}
                  cartQty={cartQtyById[it.id] || 0}
                  rotationGuides={rotationGuidesForItem(rotationGuides, it.id)}
                  onSelect={mode === "rent" ? pickItemForRent : () => {}}
                />
              ))}
              {!filteredItems.length ? (
                <p className="kiosk-muted">검색 결과가 없습니다.</p>
              ) : null}
            </div>
            {mode === "browse" ? (
              <p className="kiosk-hint">둘러보기만 가능합니다. 대여·반납은 홈에서 선택하세요.</p>
            ) : null}
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
            {mode === "rent" && cart.length ? (
              <button
                type="button"
                className="kiosk-cart-fab"
                onClick={goRentCart}
                aria-label="장바구니 보기"
              >
                <ShoppingBag size={20} />
                <span>{cart.length}종 총 {cartCount}개 · 장바구니 보기</span>
              </button>
            ) : null}
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
                  <div className="kiosk-week-row-thumb">
                    {c.photo_url ? <img src={c.photo_url} alt="" /> : <Package size={28} />}
                  </div>
                  <div className="kiosk-week-row-body">
                    <div className="kiosk-week-row-name">{c.name}</div>
                    <div className="kiosk-week-row-meta">{c.code} · 가능 {c.available}개</div>
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

        {((mode === "rent" && step === "teacher") || (mode === "return" && step === "teacher") || (mode === "week" && step === "teacher")) ? (
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
              <p className="kiosk-month-hint">교구를 클릭하면 장바구니에 담겨요</p>
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
              {(monthGear?.weeks || []).map((week) => (
                <div key={`w-${week.weekNumber}`} className="kiosk-month-week-card">
                  <div className="kiosk-month-week-head">
                    <strong>{week.weekLabel || `${week.weekNumber}주차`}</strong>
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
                            <RotationGuideLines guides={rotationGuidesForItem(rotationGuides, row.item_id)} />
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
              ))}
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

        {((mode === "rent" && step === "pin") || (mode === "return" && step === "pin")) && selectedTeacher ? (
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
          <div className="kiosk-browse">
            <h1>{selectedTeacher?.name}님 보유 교구</h1>
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
            <div className="kiosk-item-grid">
              {holdings.map((h) => (
                <button
                  key={h.item_id}
                  type="button"
                  className="kiosk-item-card"
                  onClick={() => pickHolding(h)}
                >
                  <div className="kiosk-item-thumb">
                    {h.photo_url ? <img src={h.photo_url} alt="" /> : <Package size={36} />}
                  </div>
                  <div className="kiosk-item-body">
                    <div className="kiosk-item-name">{h.name}</div>
                    <div className="kiosk-item-meta">{h.code}</div>
                    <div className="kiosk-item-stock">반납 가능 {h.returnable}</div>
                  </div>
                </button>
              ))}
              {!holdings.length ? <p className="kiosk-muted">반납할 교구가 없습니다.</p> : null}
            </div>
          </div>
        ) : null}

        {mode === "return" && step === "qty" && selectedItem ? (
          <div className="kiosk-panel">
            <h1>반납 수량</h1>
            <div className="kiosk-selected">
              <strong>{selectedItem.name}</strong>
              <span>가능 {selectedItem.available}개</span>
            </div>
            <QtyStepper value={qty} min={1} max={Math.max(1, selectedItem.available)} onChange={setQty} />
            <label className="kiosk-field">
              <span>반납 위치</span>
              <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="반납 위치">
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
            <button
              type="button"
              className="kiosk-btn kiosk-btn--return"
              disabled={busy}
              onClick={submitReturn}
            >
              {busy ? "처리 중..." : "반납 완료"}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
