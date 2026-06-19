import { useCallback, useEffect, useRef, useState } from "react";

/** 모바일 Safari/Chrome 제스처 잠금 해제용 무음 MP3 */
const SILENT_AUDIO_SRC =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhAC2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2//////////////////////////////////////////8AAAAATGF2YzU4LjM1AAAAAAAAAAAAAAAAJAYAAAAAAAAAAYQYRwmHAAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

function prepareAudioElement(audio) {
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.playsInline = true;
  audio.preload = "auto";
}

/** 클릭 핸들러 안에서 동기 호출 — await 전에 play()로 오디오 잠금 해제 */
function unlockAudioInGesture(audio) {
  prepareAudioElement(audio);
  audio.pause();
  audio.src = SILENT_AUDIO_SRC;
  audio.load();
  void audio.play().catch(() => {});
}

export function useGoogleTts() {
  const [status, setStatus] = useState("idle");
  const [activeId, setActiveId] = useState(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      prepareAudioElement(audio);
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const releaseBlobUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;

    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
    }
    releaseBlobUrl();
    setActiveId(null);
    setStatus("idle");
  }, [releaseBlobUrl]);

  useEffect(() => () => stop(), [stop]);

  const playFromBlob = useCallback(async (audio, url, id, requestId) => {
    releaseBlobUrl();
    urlRef.current = url;

    audio.onended = () => {
      if (requestIdRef.current !== requestId) return;
      releaseBlobUrl();
      setActiveId(null);
      setStatus("idle");
    };
    audio.onerror = () => {
      if (requestIdRef.current !== requestId) return;
      console.error("Google TTS playback error");
      releaseBlobUrl();
      setActiveId(null);
      setStatus("idle");
    };

    audio.src = url;
    audio.load();
    setStatus("playing");

    try {
      await audio.play();
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      if (err?.name === "NotAllowedError") {
        console.warn(
          "Google TTS blocked by browser (NotAllowedError). "
          + "Tap the listen button again.",
        );
      } else {
        console.error("Google TTS play failed:", err);
      }
      releaseBlobUrl();
      setActiveId(null);
      setStatus("idle");
    }
  }, [releaseBlobUrl]);

  const fetchAndPlay = useCallback(async (text, id, requestId) => {
    const apiKey = import.meta.env.VITE_GOOGLE_TTS_KEY;
    if (!apiKey) {
      console.error("VITE_GOOGLE_TTS_KEY is not set");
      setActiveId(null);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: "en-US", name: "en-US-Neural2-F" },
            audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        throw new Error(await res.text() || res.statusText);
      }

      const { audioContent } = await res.json();
      if (!audioContent) throw new Error("empty audioContent");
      if (controller.signal.aborted || requestIdRef.current !== requestId) return;

      abortRef.current = null;

      const bytes = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      const audio = getAudio();

      await playFromBlob(audio, url, id, requestId);
    } catch (err) {
      if (err.name === "AbortError") return;
      if (requestIdRef.current !== requestId) return;
      console.error("Google TTS failed:", err);
      setActiveId(null);
      setStatus("idle");
    }
  }, [getAudio, playFromBlob]);

  const play = useCallback((text, id) => {
    const trimmed = text?.trim();
    if (!trimmed) return;

    stop();

    const audio = getAudio();
    unlockAudioInGesture(audio);

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setActiveId(id ?? null);
    setStatus("loading");

    void fetchAndPlay(trimmed, id, requestId);
  }, [stop, getAudio, fetchAndPlay]);

  const toggle = useCallback((text, id) => {
    if (!text?.trim()) return;
    if (id != null && activeId === id && (status === "playing" || status === "loading")) {
      stop();
      return;
    }
    play(text, id);
  }, [activeId, status, stop, play]);

  const isLineLoading = useCallback(
    (id) => activeId === id && status === "loading",
    [activeId, status],
  );

  const isLinePlaying = useCallback(
    (id) => activeId === id && status === "playing",
    [activeId, status],
  );

  return {
    status,
    activeId,
    toggle,
    stop,
    isLoading: status === "loading",
    isPlaying: status === "playing",
    isLineLoading,
    isLinePlaying,
  };
}
