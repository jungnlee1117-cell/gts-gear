import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
  if (sameDay) return hm;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** 받은 푸시 알림을 모아 보는 종 아이콘 + 목록 */
export default function PushInboxBell({ supabase, me, dark = false, buttonStyle }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadCount = useCallback(async () => {
    if (!me?.id) return;
    const { count, error } = await supabase
      .from("push_inbox")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", me.id)
      .is("read_at", null);
    if (!error) setUnread(count || 0);
  }, [supabase, me?.id]);

  const loadRows = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("push_inbox")
      .select("id, title, body, url, created_at, read_at")
      .eq("teacher_id", me.id)
      .order("created_at", { ascending: false })
      .limit(60);
    setRows(data || []);
    setLoading(false);
  }, [supabase, me?.id]);

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") loadCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadCount]);

  useEffect(() => {
    if (open) loadRows();
  }, [open, loadRows]);

  const markRead = async (ids) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setRows(prev => prev.map(r => (ids.includes(r.id) ? { ...r, read_at: r.read_at || now } : r)));
    setUnread(prev => Math.max(0, prev - ids.length));
    await supabase.from("push_inbox").update({ read_at: now }).in("id", ids).is("read_at", null);
  };

  const openRow = async (row) => {
    if (!row.read_at) await markRead([row.id]);
    setOpen(false);
    const url = String(row.url || "/gear");
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener");
      return;
    }
    navigate(url);
  };

  const unreadIds = rows.filter(r => !r.read_at).map(r => r.id);
  if (!me?.id) return null;

  return (
    <>
      <button
        type="button"
        className="push-inbox-bell"
        aria-label={unread > 0 ? `알림 ${unread}개 안 읽음` : "알림"}
        onClick={() => setOpen(true)}
        style={buttonStyle}
        data-dark={dark ? "1" : undefined}
      >
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && <span className="push-inbox-bell__badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="push-inbox-overlay" onClick={() => setOpen(false)} role="presentation">
          <div className="push-inbox-panel" onClick={e => e.stopPropagation()} role="dialog" aria-label="알림">
            <div className="push-inbox-panel__head">
              <strong>알림</strong>
              <div className="push-inbox-panel__head-actions">
                {unreadIds.length > 0 && (
                  <button type="button" className="push-inbox-panel__text-btn" onClick={() => markRead(unreadIds)}>
                    모두 읽음
                  </button>
                )}
                <button type="button" className="push-inbox-panel__close" aria-label="닫기" onClick={() => setOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="push-inbox-panel__list">
              {loading && !rows.length ? (
                <p className="push-inbox-panel__empty">불러오는 중...</p>
              ) : !rows.length ? (
                <p className="push-inbox-panel__empty">받은 알림이 없습니다.</p>
              ) : rows.map(row => (
                <button
                  key={row.id}
                  type="button"
                  className={`push-inbox-item${row.read_at ? "" : " push-inbox-item--unread"}`}
                  onClick={() => openRow(row)}
                >
                  <span className="push-inbox-item__dot" aria-hidden />
                  <span className="push-inbox-item__main">
                    <span className="push-inbox-item__title">{row.title}</span>
                    {row.body ? <span className="push-inbox-item__body">{row.body}</span> : null}
                  </span>
                  <span className="push-inbox-item__time">{formatWhen(row.created_at)}</span>
                </button>
              ))}
            </div>
            <p className="push-inbox-panel__foot">최근 30일 알림이 보관됩니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
