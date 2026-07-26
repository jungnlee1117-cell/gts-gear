import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { askGiti, getGitiApiKey } from "./giti/gitiApi.js";
import { GITI_WELCOME } from "./giti/gitiSystemPrompt.js";

const SUGGESTIONS = [
  "아이가 울어서 수업에 안 들어와요",
  "5세 에어터널 수업 아이디어",
  "산만할 때 바로 쓸 영어 표현",
  "어린이날 이벤트 프로그램 뭐 있어요?",
];

/**
 * 모든 인증 페이지 우측 하단 — 지티(GiTi) 채팅
 */
export default function GitiAssistant({ teacherName = "" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState(() => [
    { id: "welcome", role: "assistant", content: GITI_WELCOME },
  ]);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      document.body.style.overflow = prev || "";
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const send = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    const userMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const reply = await askGiti(history.slice(0, -1), text);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply },
      ]);
    } catch (err) {
      setError(err?.message || "잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const keyConfigured = Boolean(getGitiApiKey());

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
        <div className="giti-overlay" role="presentation" onClick={() => setOpen(false)}>
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

            <div className="giti-panel__messages" ref={listRef}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`giti-bubble giti-bubble--${m.role}`}
                >
                  {m.role === "assistant" ? (
                    <span className="giti-bubble__name">지티</span>
                  ) : null}
                  <div className="giti-bubble__text">{m.content}</div>
                </div>
              ))}
              {busy ? (
                <div className="giti-bubble giti-bubble--assistant">
                  <span className="giti-bubble__name">지티</span>
                  <div className="giti-bubble__text giti-bubble__typing">
                    <span /><span /><span />
                  </div>
                </div>
              ) : null}
            </div>

            {messages.length <= 1 && !busy ? (
              <div className="giti-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="giti-suggestion"
                    onClick={() => send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            {error ? <p className="giti-error">{error}</p> : null}
            {!keyConfigured ? (
              <p className="giti-error">
                VITE_ANTHROPIC_API_KEY 가 없어 답변할 수 없어요. Vercel 환경변수를 설정한 뒤 재배포해주세요.
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
                onChange={(e) => setInput(e.target.value)}
                placeholder="현장 고민을 물어보세요…"
                disabled={busy || !keyConfigured}
                enterKeyHint="send"
                autoComplete="off"
              />
              <button
                type="submit"
                className="giti-panel__send"
                disabled={busy || !keyConfigured || !input.trim()}
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
