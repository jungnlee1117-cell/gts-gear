import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2,
} from "lucide-react";
import { formatAudioDisplayTitle, formatDuration, pickNextTrackIndex } from "./peMediaUtils.js";
import { prepareBackgroundAudioElement, usePeAudioMediaSession } from "./usePeAudioMediaSession.js";

export default function AudioPlayer({
  tracks = [],
  currentIndex,
  onIndexChange,
  playing: playingProp,
  onPlayingChange,
  trackSelected = false,
  drawerOpen = false,
  onToggleDrawer,
  onDurationUpdate,
}) {
  const audioRef = useRef(null);
  const [playingInternal, setPlayingInternal] = useState(false);
  const playing = playingProp ?? playingInternal;
  const setPlaying = onPlayingChange ?? setPlayingInternal;
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const shufflePlayedRef = useRef(new Set());
  const advancingRef = useRef(false);

  const current = trackSelected ? (tracks[currentIndex] || null) : null;
  const src = current?.file_url || "";
  const displayCover = current?.cover_url;
  const displayTitle = formatAudioDisplayTitle(current?.title) || "재생할 곡을 선택하세요";

  const nextIndex = useMemo(() => {
    if (!trackSelected || !tracks.length) return null;
    return pickNextTrackIndex(currentIndex, tracks.length, {
      shuffle,
      repeatMode,
      shufflePlayed: shufflePlayedRef.current,
    });
  }, [trackSelected, tracks.length, currentIndex, shuffle, repeatMode]);

  const nextTrack = nextIndex != null ? tracks[nextIndex] : null;

  const cycleRepeat = () => {
    setRepeatMode(prev => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  };

  const playAt = useCallback((index) => {
    if (!tracks.length) return;
    const next = ((index % tracks.length) + tracks.length) % tracks.length;
    onIndexChange(next);
    setPlaying(true);
  }, [tracks.length, onIndexChange, setPlaying]);

  const playPrev = useCallback(() => {
    if (!tracks.length) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    playAt(currentIndex - 1);
  }, [tracks.length, currentIndex, playAt]);

  const playNext = useCallback((fromEnded = false) => {
    if (!tracks.length || !trackSelected) return;
    if (repeatMode === "one") {
      const el = audioRef.current;
      if (el) {
        el.currentTime = 0;
        el.play().catch(() => setPlaying(false));
      }
      return;
    }
    const next = pickNextTrackIndex(currentIndex, tracks.length, {
      shuffle,
      repeatMode,
      shufflePlayed: shufflePlayedRef.current,
    });
    if (next == null) {
      setPlaying(false);
      return;
    }
    if (shuffle) shufflePlayedRef.current.add(next);

    const nextTrack = tracks[next];
    const nextSrc = nextTrack?.file_url || "";
    if (fromEnded && audioRef.current && nextSrc) {
      const el = audioRef.current;
      advancingRef.current = true;
      el.src = nextSrc;
      el.load();
      el.play()
        .catch(() => setPlaying(false))
        .finally(() => {
          advancingRef.current = false;
        });
    }

    onIndexChange(next);
    setPlaying(true);
  }, [tracks, trackSelected, currentIndex, shuffle, repeatMode, onIndexChange, setPlaying]);

  const handleEnded = useCallback(() => {
    playNext(true);
  }, [playNext]);

  usePeAudioMediaSession({
    enabled: trackSelected && Boolean(current),
    title: displayTitle,
    coverUrl: displayCover,
    playing,
    progress,
    duration,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onPrevious: playPrev,
    onNext: () => playNext(false),
  });

  useEffect(() => {
    const onVisibilityChange = () => {
      const el = audioRef.current;
      if (!document.hidden || !playing || !el || !src) return;
      if (el.paused) {
        el.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [playing, src]);

  useEffect(() => {
    shufflePlayedRef.current = new Set([currentIndex]);
  }, [shuffle, currentIndex]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    prepareBackgroundAudioElement(el);
    el.volume = volume;
    if (playing && src) {
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [playing, src, volume, setPlaying]);

  useEffect(() => {
    setProgress(0);
    setDuration(0);
  }, [currentIndex, src]);

  const togglePlay = () => {
    if (!src || !trackSelected) return;
    setPlaying(p => !p);
  };

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    setProgress(el.currentTime);
    const d = el.duration || 0;
    setDuration(d);
    if (current?.id && d > 0) onDurationUpdate?.(current.id, d);
  };

  const onSeek = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setProgress(el.currentTime);
  };

  const nextTitle = nextTrack ? formatAudioDisplayTitle(nextTrack.title) : null;
  const showTrackNo = trackSelected && tracks.length > 0;

  if (!trackSelected) return null;

  return (
    <div className={`pe-audio-bottom-player${drawerOpen ? " pe-audio-bottom-player--drawer-open" : ""}`}>
      <audio
        ref={audioRef}
        src={src || undefined}
        playsInline
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          if (advancingRef.current || audioRef.current?.ended) return;
          setPlaying(false);
        }}
      />

      <div className="pe-audio-bottom-player-inner">
        <div className="pe-audio-bottom-left">
          <div className="pe-audio-bottom-art">
            {displayCover ? (
              <img src={displayCover} alt=""/>
            ) : (
              <span className="pe-audio-bottom-art-fallback" aria-hidden>♪</span>
            )}
          </div>
          <div className="pe-audio-bottom-meta">
            <div className="pe-audio-bottom-title">{displayTitle}</div>
            {nextTitle ? (
              <div className="pe-audio-bottom-sub">{nextTitle}</div>
            ) : null}
            {showTrackNo ? (
              <div className="pe-audio-bottom-seq">{currentIndex + 1} / {tracks.length}</div>
            ) : null}
          </div>
        </div>

        <div className="pe-audio-bottom-center">
          <div className="pe-audio-bottom-controls">
            <button
              type="button"
              className={`pe-audio-ctrl-btn${shuffle ? " pe-audio-ctrl-btn--active" : ""}`}
              onClick={() => setShuffle(s => !s)}
              aria-label="셔플"
            >
              <Shuffle size={17}/>
            </button>
            <button type="button" className="pe-audio-ctrl-btn" onClick={playPrev} aria-label="이전 곡">
              <SkipBack size={20}/>
            </button>
            <button type="button" className="pe-audio-ctrl-btn pe-audio-ctrl-btn--play" onClick={togglePlay} aria-label={playing ? "일시정지" : "재생"}>
              {playing ? <Pause size={22}/> : <Play size={22}/>}
            </button>
            <button type="button" className="pe-audio-ctrl-btn" onClick={() => playNext(false)} aria-label="다음 곡">
              <SkipForward size={20}/>
            </button>
            <button
              type="button"
              className={`pe-audio-ctrl-btn${repeatMode !== "off" ? " pe-audio-ctrl-btn--active" : ""}`}
              onClick={cycleRepeat}
              aria-label="반복"
            >
              {repeatMode === "one" ? <Repeat1 size={17}/> : <Repeat size={17}/>}
            </button>
          </div>
          <div className="pe-audio-bottom-progress-row">
            <span className="pe-audio-bottom-time">{formatDuration(progress)}</span>
            <div className="pe-audio-bottom-progress" onClick={onSeek} role="slider" aria-valuemin={0} aria-valuemax={duration || 0} aria-valuenow={progress}>
              <div className="pe-audio-bottom-progress-fill" style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}/>
            </div>
            <span className="pe-audio-bottom-time">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="pe-audio-bottom-right">
          <div className="pe-audio-bottom-volume">
            <Volume2 size={16} aria-hidden/>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              aria-label="볼륨"
            />
          </div>
          <button
            type="button"
            className={`pe-audio-playlist-toggle${drawerOpen ? " pe-audio-playlist-toggle--active" : ""}`}
            onClick={onToggleDrawer}
            aria-label="재생 목록"
            aria-expanded={drawerOpen}
          >
            <ListMusic size={16}/>
            <span>{tracks.length}곡</span>
          </button>
        </div>
      </div>
    </div>
  );
}
