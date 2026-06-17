import { useCallback, useEffect, useRef, useState } from "react";

export function useGoogleTts() {
  const [status, setStatus] = useState("idle");
  const [activeId, setActiveId] = useState(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const abortRef = useRef(null);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    releaseAudio();
    setActiveId(null);
    setStatus("idle");
  }, [releaseAudio]);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(async (text, id) => {
    const trimmed = text?.trim();
    if (!trimmed) return;

    const apiKey = import.meta.env.VITE_GOOGLE_TTS_KEY;
    if (!apiKey) {
      console.error("VITE_GOOGLE_TTS_KEY is not set");
      return;
    }

    stop();
    setActiveId(id ?? null);
    setStatus("loading");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text: trimmed },
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
      if (controller.signal.aborted) return;

      const bytes = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      abortRef.current = null;

      audio.onended = () => {
        releaseAudio();
        setActiveId(null);
        setStatus("idle");
      };
      audio.onerror = () => {
        releaseAudio();
        setActiveId(null);
        setStatus("idle");
      };

      setStatus("playing");
      await audio.play();
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Google TTS failed:", err);
      }
      releaseAudio();
      setActiveId(null);
      setStatus("idle");
    }
  }, [stop, releaseAudio]);

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
