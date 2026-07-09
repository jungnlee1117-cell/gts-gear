import { useEffect, useRef } from "react";

const DEFAULT_ARTWORK = "/pwa-192x192.png";

function buildArtwork(coverUrl) {
  const src = coverUrl || DEFAULT_ARTWORK;
  return [
    { src, sizes: "96x96", type: "image/png" },
    { src, sizes: "128x128", type: "image/png" },
    { src, sizes: "256x256", type: "image/png" },
    { src, sizes: "512x512", type: "image/png" },
  ];
}

function safeSetActionHandler(mediaSession, action, handler) {
  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    /* Safari may reject unsupported actions */
  }
}

/**
 * 잠금화면·헤드셋·CarPlay 등 OS 미디어 컨트롤 연동
 */
export function usePeAudioMediaSession({
  enabled,
  title,
  coverUrl,
  playing,
  progress,
  duration,
  onPlay,
  onPause,
  onPrevious,
  onNext,
}) {
  const handlersRef = useRef({ onPlay, onPause, onPrevious, onNext });
  handlersRef.current = { onPlay, onPause, onPrevious, onNext };

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return undefined;
    }

    const ms = navigator.mediaSession;

    safeSetActionHandler(ms, "play", () => handlersRef.current.onPlay?.());
    safeSetActionHandler(ms, "pause", () => handlersRef.current.onPause?.());
    safeSetActionHandler(ms, "previoustrack", () => handlersRef.current.onPrevious?.());
    safeSetActionHandler(ms, "nexttrack", () => handlersRef.current.onNext?.());

    return () => {
      safeSetActionHandler(ms, "play", null);
      safeSetActionHandler(ms, "pause", null);
      safeSetActionHandler(ms, "previoustrack", null);
      safeSetActionHandler(ms, "nexttrack", null);
      ms.playbackState = "none";
      ms.metadata = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const ms = navigator.mediaSession;

    if (!title) {
      ms.metadata = null;
      ms.playbackState = "none";
      return;
    }

    ms.metadata = new MediaMetadata({
      title,
      artist: "GTS 음원 자료실",
      album: "체육 프로그램 BGM",
      artwork: buildArtwork(coverUrl),
    });
    ms.playbackState = playing ? "playing" : "paused";
  }, [enabled, title, coverUrl, playing]);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, progress), duration),
      });
    } catch {
      /* setPositionState 미지원 브라우저 */
    }
  }, [enabled, progress, duration]);
}

export function prepareBackgroundAudioElement(audio) {
  if (!audio) return;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.playsInline = true;
  audio.preload = "auto";
}
