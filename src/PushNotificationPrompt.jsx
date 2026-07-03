import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  getPushPromptState,
  isPushSupported,
  setPushPromptState,
  subscribeToPush,
} from "./pushNotifications.js";

export default function PushNotificationPrompt({ supabase, teacherId }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teacherId || !isPushSupported()) return;

    const state = getPushPromptState();
    if (state === "subscribed" || state === "dismissed") return;
    if (Notification.permission === "granted") {
      subscribeToPush(supabase, teacherId).catch(() => {});
      return;
    }
    if (Notification.permission === "denied") {
      setPushPromptState("dismissed");
      return;
    }

    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [teacherId, supabase]);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    try {
      const result = await subscribeToPush(supabase, teacherId);
      if (result.ok) {
        setVisible(false);
      } else if (result.reason === "denied") {
        setPushPromptState("dismissed");
        setVisible(false);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, teacherId]);

  const handleDismiss = useCallback(() => {
    setPushPromptState("dismissed");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="push-prompt" role="dialog" aria-label="알림 허용">
      <div className="push-prompt__icon" aria-hidden>
        <Bell size={20}/>
      </div>
      <div className="push-prompt__body">
        <strong>알림을 켜시겠어요?</strong>
        <p>대여 승인·수업 변동 등 중요한 소식을 푸시로 받을 수 있습니다.</p>
        <p className="push-prompt__hint">iOS는 홈 화면에 추가한 후에만 알림이 작동합니다.</p>
      </div>
      <div className="push-prompt__actions">
        <button
          type="button"
          className="push-prompt__btn push-prompt__btn--primary"
          disabled={loading}
          onClick={handleEnable}
        >
          {loading ? "설정 중…" : "알림 허용"}
        </button>
        <button
          type="button"
          className="push-prompt__btn push-prompt__btn--ghost"
          onClick={handleDismiss}
          aria-label="닫기"
        >
          <X size={18}/>
        </button>
      </div>
    </div>
  );
}
