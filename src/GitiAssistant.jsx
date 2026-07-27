import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { askGiti, getGitiApiKey } from "./giti/gitiApi.js";
import { buildGitiMinimalContext, loadGitiTeacherContext } from "./giti/gitiContext.js";
import { GITI_WELCOME } from "./giti/gitiSystemPrompt.js";

const SUGGESTIONS = [
  "만 1세 수업 어떻게 해요?",
  "내 교구로 할 수 있는 활동 알려줘",
  "오늘 만나는 아이가 울어요",
  "영어 표현 추천해줘",
];

const GEAR_ACTIVITY_SUGGESTION = "내 교구로 할 수 있는 활동 알려줘";

const CONTEXT_TIMEOUT_MS = 5000;
const KEY_CONFIGURED = Boolean(
  typeof import.meta !== "undefined"
    && String(import.meta.env?.VITE_ANTHROPIC_API_KEY || "").trim(),
);

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ text: "", timedOut: true }), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const GitiBubble = memo(function GitiBubble({ role, content, typing = false }) {
  return (
    <div className={`giti-bubble giti-bubble--${role}`}>
      {role === "assistant" ? (
        <span className="giti-bubble__name">지티</span>
      ) : null}
      {typing ? (
        <div className="giti-bubble__text giti-bubble__typing" aria-hidden>
          <span /><span /><span />
        </div>
      ) : (
        <div className="giti-bubble__text">{content}</div>
      )}
    </div>
  );
});

const GitiMessageList = memo(function GitiMessageList({ messages, busy, listRef, onScroll }) {
  const nodes = useMemo(
    () => messages.map((m) => (
      <GitiBubble key={m.id} role={m.role} content={m.content} />
    )),
    [messages],
  );

  return (
    <div className="giti-panel__messages" ref={listRef} onScroll={onScroll}>
      {nodes}
      {/* 마운트 유지 + opacity로 전환 → 레이아웃/키보드 깜빡임 방지 */}
      <div
        className={`giti-typing-slot${busy ? " is-visible" : ""}`}
        aria-hidden={!busy}
      >
        <GitiBubble role="assistant" typing />
      </div>
    </div>
  );
});

/**
 * 모든 인증 페이지 우측 하단 — 지티(GiTi) 채팅
 */
function GitiAssistant({ me = null, session = null, supabase = null }) {
  const teacherName = me?.name || "";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState(() => [
    { id: "welcome", role: "assistant", content: GITI_WELCOME },
  ]);
  const contextRef = useRef("");
  const contextDataRef = useRef(null);
  const contextPromiseRef = useRef(null);
  const sessionRef = useRef(session);
  const messagesRef = useRef(messages);
  const busyRef = useRef(false);
  const inputValueRef = useRef("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const shouldStickRef = useRef(true);

  sessionRef.current = session;
  messagesRef.current = messages;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80);
    return () => {
      document.body.style.overflow = prev || "";
      clearTimeout(t);
    };
  }, [open]);

  // 부드러운 스크롤 — 레이아웃 강제 재계산 최소화
  useEffect(() => {
    if (!open || !shouldStickRef.current) return;
    const el = listRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open || !me?.id || !supabase) {
      contextPromiseRef.current = Promise.resolve({ text: contextRef.current || "" });
      return undefined;
    }

    let cancelled = false;
    const minimal = buildGitiMinimalContext(me);
    contextRef.current = minimal;
    contextDataRef.current = null;

    const loadPromise = loadGitiTeacherContext({
      me,
      session: sessionRef.current,
      supabase,
    }).catch((err) => {
      console.warn("[giti] context load failed", err);
      return { text: "" };
    });

    const applyResult = (result) => {
      if (cancelled || !result) return;
      if (result.text) contextRef.current = result.text;
      if (result.data) contextDataRef.current = result.data;
    };

    contextPromiseRef.current = withTimeout(loadPromise, CONTEXT_TIMEOUT_MS).then((result) => {
      if (cancelled) return result;
      if (result?.text || result?.data) applyResult(result);
      else if (result?.timedOut) {
        console.warn("[giti] context load timed out (5s)");
      }
      return result;
    });

    loadPromise.then((result) => {
      applyResult(result);
    });

    return () => {
      cancelled = true;
    };
  }, [open, me?.id, me?.name, me?.role, supabase]);

  const send = useCallback(async (raw) => {
    const text = String(raw ?? inputValueRef.current).trim();
    if (!text || busyRef.current) return;
    inputValueRef.current = "";
    setInput("");
    setError("");
    shouldStickRef.current = true;
    const userMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    busyRef.current = true;
    try {
      if (contextPromiseRef.current) {
        await contextPromiseRef.current.catch(() => {});
      }
      const appContextText = contextRef.current || buildGitiMinimalContext(me) || "";
      const history = [...messagesRef.current, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const reply = await askGiti(history.slice(0, -1), text, { appContextText });
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply },
      ]);
    } catch (err) {
      setError(err?.message || "잠시 후 다시 시도해주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [me]);

  const onSuggestion = useCallback(async (s) => {
    if (s !== GEAR_ACTIVITY_SUGGESTION) {
      void send(s);
      return;
    }
    if (busyRef.current) return;
    if (contextPromiseRef.current) {
      await contextPromiseRef.current.catch(() => {});
    }
    // 5초 타임아웃 직후라도 풀 로드가 곧 끝나면 이번 주 교구 반영
    if (!contextDataRef.current?.gear?.thisWeek?.display) {
      const start = Date.now();
      while (
        Date.now() - start < 2500
        && !contextDataRef.current?.gear?.thisWeek?.display
      ) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const thisWeek = contextDataRef.current?.gear?.thisWeek;
    const gearLabel = thisWeek?.display
      ? `${thisWeek.display}${thisWeek.range ? ` (${thisWeek.range})` : ""}`
      : "";
    const enriched = gearLabel
      ? `${GEAR_ACTIVITY_SUGGESTION}\n\n[이번 주 배정 교구: ${gearLabel}]\n위 교구로 바로 쓸 수 있는 활동법을 알려줘.`
      : `${GEAR_ACTIVITY_SUGGESTION}\n\n실시간 앱 데이터의 "이번 주 교구"를 확인하고, 그 교구로 바로 쓸 수 있는 활동법을 알려줘. 교구가 없으면 먼저 이번 주 교구가 없다고 말해줘.`;
    void send(enriched);
  }, [send]);

  const keyConfigured = KEY_CONFIGURED || Boolean(getGitiApiKey());
  const showSuggestions = messages.length <= 1 && !busy;

  const onMessagesScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickRef.current = dist < 80;
  }, []);

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="giti-fab"
          onClick={() => setOpen(true)}
          aria-label="지티에게 물어보기"
        >
          <MessageCircle size={22} strokeWidth={2.2} aria-hidden />
          <span className="giti-fab__label">지티</span>
        </button>
      ) : null}

      {open ? (
        <div
          className="giti-overlay"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="giti-panel"
            role="dialog"
            aria-modal="true"
            aria-label="지티 AI 어시스턴트"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="giti-panel__head">
              <div className="giti-panel__brand">
                <span className="giti-panel__avatar" aria-hidden>
                  <Sparkles size={18} />
                </span>
                <div>
                  <div className="giti-panel__title">지티 (GiTi)</div>
                  <div className="giti-panel__sub">
                    {teacherName ? `${teacherName} 선생님, ` : ""}
                    GTS 수업 도우미
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="giti-panel__close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </header>

            <GitiMessageList
              messages={messages}
              busy={busy}
              listRef={listRef}
              onScroll={onMessagesScroll}
            />

            {showSuggestions ? (
              <div className="giti-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="giti-suggestion"
                    onClick={() => { void onSuggestion(s); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            {error ? <p className="giti-error">{error}</p> : null}
            {!keyConfigured ? (
              <p className="giti-error">
                VITE_ANTHROPIC_API_KEY 가 없어 답변할 수 없어요. .env.local에 저장 후 npm run dev를 재시작하거나, Vercel 환경변수 설정 후 재배포해주세요.
              </p>
            ) : null}

            <form
              className="giti-panel__composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                ref={inputRef}
                className="giti-panel__input"
                value={input}
                onChange={(e) => {
                  inputValueRef.current = e.target.value;
                  setInput(e.target.value);
                }}
                placeholder="현장 고민·내 일정·교구를 물어보세요…"
                disabled={!keyConfigured}
                enterKeyHint="send"
                autoComplete="off"
              />
              <button
                type="submit"
                className="giti-panel__send"
                disabled={!keyConfigured || busy || !input.trim()}
                aria-label="보내기"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default memo(GitiAssistant, (prev, next) => (
  prev.me?.id === next.me?.id
  && prev.me?.name === next.me?.name
  && prev.me?.role === next.me?.role
  && prev.session?.access_token === next.session?.access_token
  && prev.supabase === next.supabase
));
