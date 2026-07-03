import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  canShowPushPrompt,
  getPushPromptState,
  isIosStandalonePwa,
  registerPushSubscription,
  requestNotificationPermission,
  setPushPromptState,
} from "./pushNotifications.js";

export default function PushNotificationPrompt({ supabase, teacherId }) {
  const [visible, setVisible] = useState(false);
  const [iosBrowserHint, setIosBrowserHint] = useState(false);

  useEffect(() => {
    if (!teacherId) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIos && !isIosStandalonePwa()) {
      setIosBrowserHint(true);
      return;
    }

    if (!canShowPushPrompt()) return;

    const state = getPushPromptState();
    if (state === "subscribed" || state === "dismissed") return;

    if (Notification.permission === "granted") {
      registerPushSubscription(supabase, teacherId).catch(() => {});
      return;
    }
    if (Notification.permission === "denied") {
      setPushPromptState("dismissed");
      return;
    }

    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [teacherId, supabase]);

  /**
   * iOS PWA: 클릭 직후 setState 없이 requestPermission()을 첫 await로 호출해야
   * "알림을 허용하겠습니까?" 시스템 팝업이 표시됨
   */
  const handleEnable = useCallback(() => {
    if (!teacherId) return;

    void (async () => {
      const permission = await requestNotificationPermission();

      if (permission !== "granted") {
        if (permission === "denied") setPushPromptState("dismissed");
        setVisible(false);
        return;
      }

      // 허용 직후 배너 닫기
      setPushPromptState("subscribed");
      setVisible(false);

      try {
        await registerPushSubscription(supabase, teacherId);
      } catch (err) {
        console.error("push subscription failed:", err);
      }
    })();
  }, [supabase, teacherId]);

  const handleDismiss = useCallback(() => {
    setPushPromptState("dismissed");
    setVisible(false);
    setIosBrowserHint(false);
  }, []);

  if (iosBrowserHint && getPushPromptState() !== "dismissed") {
    return (
      <div className="push-prompt" role="dialog" aria-label="알림 설정 안내">
        <div className="push-prompt__icon" aria-hidden>
          <Bell size={20}/>
        </div>
        <div className="push-prompt__body">
          <strong>홈 화면에 추가해 주세요</strong>
          <p>iOS에서는 Safari 공유 버튼 → &apos;홈 화면에 추가&apos; 후 앱을 열어야 푸시 알림을 받을 수 있습니다.</p>
        </div>
        <div className="push-prompt__actions">
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

  if (!visible) return null;

  return (
    <div className="push-prompt" role="dialog" aria-label="알림 허용">
      <div className="push-prompt__icon" aria-hidden>
        <Bell size={20}/>
      </div>
      <div className="push-prompt__body">
        <strong>알림을 켜시겠어요?</strong>
        <p>대여 승인·수업 변동 등 중요한 소식을 푸시로 받을 수 있습니다.</p>
      </div>
      <div className="push-prompt__actions">
        <button
          type="button"
          className="push-prompt__btn push-prompt__btn--primary"
          onClick={handleEnable}
        >
          알림 허용
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
