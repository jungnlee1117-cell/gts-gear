import { useCallback, useEffect, useRef, useState } from "react";

function micErrorMessage(err) {
  if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
    return "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.";
  }
  if (err?.name === "NotFoundError") {
    return "마이크를 찾을 수 없습니다. 장치를 연결한 뒤 다시 시도해 주세요.";
  }
  return "마이크를 사용할 수 없습니다. 다시 시도해 주세요.";
}

export function useLineRecording() {
  const [recordings, setRecordings] = useState({});
  const [activeRecordingKey, setActiveRecordingKey] = useState(null);
  const [playingKey, setPlayingKey] = useState(null);
  const [micError, setMicError] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const pendingKeyRef = useRef(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const revokeRecording = useCallback((rec) => {
    if (rec?.url) URL.revokeObjectURL(rec.url);
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    setPlayingKey(null);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const clearAll = useCallback(() => {
    pendingKeyRef.current = null;
    stopRecording();
    stopStream();
    stopPlayback();
    setRecordings(prev => {
      Object.values(prev).forEach(revokeRecording);
      return {};
    });
    setActiveRecordingKey(null);
    setMicError(null);
    recorderRef.current = null;
    chunksRef.current = [];
  }, [stopRecording, stopStream, stopPlayback, revokeRecording]);

  useEffect(() => () => clearAll(), [clearAll]);

  const startRecording = useCallback(async (lineKey) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("이 브라우저에서는 마이크 녹음을 지원하지 않습니다.");
      return;
    }

    try {
      setMicError(null);
      stopPlayback();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      setActiveRecordingKey(lineKey);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopStream();

        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          setRecordings(prev => {
            revokeRecording(prev[lineKey]);
            return {
              ...prev,
              [lineKey]: { url: URL.createObjectURL(blob), blob },
            };
          });
        }

        chunksRef.current = [];
        recorderRef.current = null;
        setActiveRecordingKey(null);

        const pending = pendingKeyRef.current;
        if (pending) {
          pendingKeyRef.current = null;
          startRecording(pending);
        }
      };

      recorder.onerror = () => {
        setMicError("녹음 중 오류가 발생했습니다.");
        stopStream();
        setActiveRecordingKey(null);
        recorderRef.current = null;
      };

      recorder.start();
    } catch (err) {
      console.error("Microphone access failed:", err);
      setMicError(micErrorMessage(err));
      stopStream();
      setActiveRecordingKey(null);
      recorderRef.current = null;
      pendingKeyRef.current = null;
    }
  }, [stopPlayback, stopStream, revokeRecording]);

  const toggleMic = useCallback((lineKey) => {
    if (activeRecordingKey === lineKey) {
      stopRecording();
      return;
    }
    if (activeRecordingKey) {
      pendingKeyRef.current = lineKey;
      stopRecording();
      return;
    }
    startRecording(lineKey);
  }, [activeRecordingKey, stopRecording, startRecording]);

  const playRecording = useCallback((lineKey) => {
    const rec = recordings[lineKey];
    if (!rec?.url) return;

    if (playingKey === lineKey && audioRef.current) {
      stopPlayback();
      return;
    }

    stopPlayback();
    const audio = new Audio(rec.url);
    audioRef.current = audio;
    audio.onended = () => {
      audioRef.current = null;
      setPlayingKey(null);
    };
    setPlayingKey(lineKey);
    audio.play().catch(() => {
      setMicError("녹음 파일을 재생할 수 없습니다.");
      stopPlayback();
    });
  }, [recordings, playingKey, stopPlayback]);

  const hasRecording = useCallback(
    (lineKey) => Boolean(recordings[lineKey]?.url),
    [recordings],
  );

  const isRecording = useCallback(
    (lineKey) => activeRecordingKey === lineKey,
    [activeRecordingKey],
  );

  const isPlayingRecording = useCallback(
    (lineKey) => playingKey === lineKey,
    [playingKey],
  );

  const dismissMicError = useCallback(() => setMicError(null), []);

  return {
    toggleMic,
    playRecording,
    hasRecording,
    isRecording,
    isPlayingRecording,
    micError,
    dismissMicError,
    clearAll,
    stopPlayback,
  };
}
