import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  canShowPushPrompt,
  clearPushPromptState,
  getPushEnvDiagnostics,
  getPushPromptState,
  hasPushSubscription,
  isIosStandalonePwa,
  registerPushSubscription,
  requestNotificationPermission,
  setPushPromptState,
} from "./pushNotifications.js";

export default function PushNotificationPrompt({ supabase, teacherId }) {
  const [visible, setVisible] = useState(false);
  const [iosBrowserHint, setIosBrowserHint] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!teacherId) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIos && !isIosStandalonePwa()) {
      setIosBrowserHint(true);
      return;
    }

    if (!canShowPushPrompt()) {
      console.info("[push] prompt hidden:", getPushEnvDiagnostics());
      return;
    }

    let cancelled = false;
    let timer = null;

    void (async () => {
      const state = getPushPromptState();
      if (state === "dismissed") return;

      if (Notification.permission === "denied") {
        setPushPromptState("dismissed");
        return;
      }

      if (Notification.permission === "granted") {
        const saved = await hasPushSubscription(supabase, teacherId);
        if (cancelled) return;
        if (saved) {
          setPushPromptState("subscribed");
          return;
        }
        clearPushPromptState();
        console.info("[push] permission=granted but DB empty — auto register");
        const result = await registerPushSubscription(supabase, teacherId);
        if (cancelled) return;
        if (result.ok) return;
        console.warn("[push] auto register failed:", result.reason, result.error);
      }

      if (getPushPromptState() === "subscribed") return;

      timer = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, 1200);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [teacherId, supabase]);

  const handleEnable = useCallback(() => {
    if (!teacherId || busy) return;

    // iOS: setState 전에 permission 요청을 시작하기 위해 async IIFE 사용
    void (async () => {
      console.info("[push] 알림 허용 클릭", { teacherId, env: getPushEnvDiagnostics() });

      const permission = await requestNotificationPermission();
      console.info("[push] permission 결과:", permission);

      if (permission !== "granted") {
        if (permission === "denied") setPushPromptState("dismissed");
        setVisible(false);
        setErrorMsg(permission === "denied" ? "알림이 차단되었습니다. 브라우저 설정에서 허용해 주세요." : "");
        return;
      }

      setBusy(true);
      setErrorMsg("");

      console.info("[push] registerPushSubscription 호출");
      const result = await registerPushSubscription(supabase, teacherId);
      setBusy(false);

      if (result.ok) {
        console.info("[push] 구독 등록 성공 ✅");
        setVisible(false);
        return;
      }

      const messages = {
        no_vapid: "VAPID 키 없음 — Vercel에 VITE_VAPID_PUBLIC_KEY 설정 후 재배포해 주세요.",
        unsupported: "이 브라우저/환경에서는 푸시를 지원하지 않습니다.",
        no_push_manager: "Service Worker 미준비 — 페이지 새로고침 후 다시 시도해 주세요.",
        not_granted: "알림 권한이 없습니다.",
        subscribe_error: "구독 저장 실패 — 콘솔 에러를 확인해 주세요.",
      };
      const msg = messages[result.reason] || `알림 등록 실패 (${result.reason})`;
      setErrorMsg(msg);
      console.error("[push] subscription failed:", result.reason, result.error || result);
    })();
  }, [supabase, teacherId, busy]);

  const handleDismiss = useCallback(() => {
    setPushPromptState("dismissed");
    setVisible(false);
    setIosBrowserHint(false);
    setErrorMsg("");
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
        {errorMsg ? <p className="push-prompt__hint push-prompt__hint--error">{errorMsg}</p> : null}
      </div>
      <div className="push-prompt__actions">
        <button
          type="button"
          className="push-prompt__btn push-prompt__btn--primary"
          disabled={busy}
          onClick={handleEnable}
        >
          {busy ? "등록 중…" : "알림 허용"}
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
