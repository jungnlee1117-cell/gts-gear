import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
} from "lucide-react";
import { DEFAULT_GEAR_CATEGORIES, mergeCategoriesWithDefaults } from "./gearCategoryData.js";
import { invokeKioskPublic, KioskError } from "./kioskApi.js";
import "./kiosk.css";

const TOKEN_KEY = "gts_kiosk_token";
const BRANCHES = ["사무실", "엘리트코어", "삼성점", "한남점", "나비에로"];

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

function ItemCard({ item, onSelect }) {
  return (
    <button type="button" className="kiosk-item-card" onClick={() => onSelect(item)}>
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
      </div>
    </button>
  );
}

export default function KioskApp() {
  const [token, setToken] = useState(loadToken);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [mode, setMode] = useState("home"); // home | browse | rent | return | success
  const [categories, setCategories] = useState(DEFAULT_GEAR_CATEGORIES);
  const [items, setItems] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState(BRANCHES[0]);

  // rent / return shared wizard
  const [step, setStep] = useState("pick"); // pick | qty | teacher | pin | done
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [successMsg, setSuccessMsg] = useState({ title: "", detail: "" });
  const [holdings, setHoldings] = useState([]);
  const pinSubmitting = useRef(false);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const resetWizard = useCallback(() => {
    setStep("pick");
    setSelectedItem(null);
    setQty(1);
    setSelectedTeacher(null);
    setTeacherPin("");
    setTeacherSearch("");
    setFlowError("");
    setHoldings([]);
    pinSubmitting.current = false;
  }, []);

  const goHome = useCallback(() => {
    setMode("home");
    setSearch("");
    setCategoryId("");
    resetWizard();
  }, [resetWizard]);

  const lockDevice = () => {
    saveToken("");
    setToken("");
    setUnlockPin("");
    goHome();
  };

  const refreshCatalog = useCallback(async (tok) => {
    setLoadingCatalog(true);
    setCatalogError("");
    try {
      const [catalog, teacherList] = await Promise.all([
        invokeKioskPublic("catalog", {}, tok),
        invokeKioskPublic("teachers", {}, tok),
      ]);
      setCategories(mergeCategoriesWithDefaults(catalog?.categories || []));
      setItems(catalog?.items || []);
      setTeachers(teacherList || []);
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

  const pickItemForRent = (item) => {
    if (item.available <= 0) {
      setFlowError("재고가 없습니다.");
      return;
    }
    setSelectedItem(item);
    setQty(1);
    setFlowError("");
    setStep("qty");
  };

  const submitRent = async (pin) => {
    if (pinSubmitting.current || busy || !selectedItem || !selectedTeacher) return;
    pinSubmitting.current = true;
    setBusy(true);
    setFlowError("");
    try {
      const data = await invokeKioskPublic("rent", {
        teacher_id: selectedTeacher.id,
        teacher_pin: pin,
        item_id: selectedItem.id,
        quantity: qty,
        location,
      }, token);
      setSuccessMsg({
        title: "대여 완료!",
        detail: `${selectedTeacher.name} · ${data.item_name} ${data.quantity}개`,
      });
      setMode("success");
      refreshCatalog(token);
    } catch (err) {
      setFlowError(err.message || "대여에 실패했습니다.");
      setTeacherPin("");
      pinSubmitting.current = false;
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
        title: "반납 완료!",
        detail: `${selectedTeacher.name} · ${data.item_name} ${data.quantity}개`,
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
          <div className="kiosk-brand">GTS 키오스크</div>
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

  return (
    <div className="kiosk-page">
      <header className="kiosk-top">
        {showBack ? (
          <button
            type="button"
            className="kiosk-back"
            onClick={() => {
              if (mode === "browse") goHome();
              else if (step === "pick" && mode === "rent") goHome();
              else if (step === "teacher" && mode === "return") goHome();
              else if (step === "qty") setStep(mode === "return" ? "pick" : "pick");
              else if (step === "teacher") setStep("qty");
              else if (step === "pin") setStep("teacher");
              else if (step === "confirm") setStep("qty");
              else goHome();
            }}
            aria-label="뒤로"
          >
            <ArrowLeft size={22} /> 뒤로
          </button>
        ) : (
          <div className="kiosk-brand">GTS 키오스크</div>
        )}
        <button type="button" className="kiosk-lock" onClick={lockDevice} aria-label="기기 잠금">
          잠금
        </button>
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
            <h1>무엇을 할까요?</h1>
            <div className="kiosk-home-grid">
              <button type="button" className="kiosk-home-card kiosk-home-card--rent" onClick={startRent}>
                <ShoppingBag size={48} strokeWidth={1.6} />
                <span>대여하기</span>
              </button>
              <button type="button" className="kiosk-home-card kiosk-home-card--return" onClick={startReturn}>
                <RotateCcw size={48} strokeWidth={1.6} />
                <span>반납하기</span>
              </button>
              <button type="button" className="kiosk-home-card kiosk-home-card--browse" onClick={startBrowse}>
                <Package size={48} strokeWidth={1.6} />
                <span>교구 둘러보기</span>
              </button>
            </div>
            {loadingCatalog ? <p className="kiosk-muted">목록 불러오는 중...</p> : null}
          </div>
        ) : null}

        {(mode === "browse" || (mode === "rent" && step === "pick")) ? (
          <div className="kiosk-browse">
            <h1>{mode === "rent" ? "교구 선택" : "교구 둘러보기"}</h1>
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
          </div>
        ) : null}

        {mode === "rent" && step === "qty" && selectedItem ? (
          <div className="kiosk-panel">
            <h1>수량 선택</h1>
            <div className="kiosk-selected">
              <strong>{selectedItem.name}</strong>
              <span>가능 {selectedItem.available}개</span>
            </div>
            <QtyStepper value={qty} min={1} max={Math.max(1, selectedItem.available)} onChange={setQty} />
            <label className="kiosk-field">
              <span>수령 위치</span>
              <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="수령 위치">
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <button type="button" className="kiosk-btn kiosk-btn--primary" onClick={() => setStep("teacher")}>
              다음 · 선생님 선택
            </button>
          </div>
        ) : null}

        {((mode === "rent" && step === "teacher") || (mode === "return" && step === "teacher")) ? (
          <div className="kiosk-panel">
            <h1>누가 {mode === "rent" ? "가져가세요" : "반납하세요"}?</h1>
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
                    setSelectedTeacher(t);
                    setTeacherPin("");
                    setFlowError("");
                    setStep("pin");
                  }}
                >
                  {t.name}
                  {!t.has_kiosk_pin ? <span className="kiosk-teacher-warn">PIN 미설정</span> : null}
                </button>
              ))}
            </div>
            {flowError ? <p className="kiosk-error">{flowError}</p> : null}
          </div>
        ) : null}

        {((mode === "rent" && step === "pin") || (mode === "return" && step === "pin")) && selectedTeacher ? (
          <div className="kiosk-panel kiosk-panel--center">
            <PinPad
              value={teacherPin}
              onChange={setTeacherPin}
              onSubmit={mode === "rent" ? submitRent : loadHoldingsThenPick}
              disabled={busy}
              title={`${selectedTeacher.name}님 PIN`}
              subtitle="본인 확인용 4자리 PIN을 입력하세요"
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
