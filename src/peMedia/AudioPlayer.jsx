import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2,
} from "lucide-react";
import { formatAudioDisplayTitle, formatDuration, pickNextTrackIndex } from "./peMediaUtils.js";
import { prepareBackgroundAudioElement, usePeAudioMediaSession } from "./usePeAudioMediaSession.js";

const AudioPlayerChrome = memo(function AudioPlayerChrome({
  displayTitle,
  displayCover,
  nextTitle,
  showTrackNo,
  trackNo,
  trackTotal,
  playing,
  shuffle,
  repeatMode,
  progress,
  duration,
  volume,
  drawerOpen,
  trackCount,
  onToggleShuffle,
  onPlayPrev,
  onTogglePlay,
  onPlayNext,
  onCycleRepeat,
  onSeek,
  onVolumeChange,
  onToggleDrawer,
}) {
  return (
    <div className={`pe-audio-bottom-player${drawerOpen ? " pe-audio-bottom-player--drawer-open" : ""}`}>
      <div className="pe-audio-bottom-player-inner">
        <div className="pe-audio-bottom-left">
          <div className="pe-audio-bottom-art">
            {displayCover ? (
              <img src={displayCover} alt="" className="pe-audio-bottom-art-img"/>
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
              <div className="pe-audio-bottom-seq">{trackNo} / {trackTotal}</div>
            ) : null}
          </div>
        </div>

        <div className="pe-audio-bottom-center">
          <div className="pe-audio-bottom-controls">
            <button
              type="button"
              className={`pe-audio-ctrl-btn${shuffle ? " pe-audio-ctrl-btn--active" : ""}`}
              onClick={onToggleShuffle}
              aria-label="셔플"
            >
              <Shuffle size={17}/>
            </button>
            <button type="button" className="pe-audio-ctrl-btn" onClick={onPlayPrev} aria-label="이전 곡">
              <SkipBack size={20}/>
            </button>
            <button type="button" className="pe-audio-ctrl-btn pe-audio-ctrl-btn--play" onClick={onTogglePlay} aria-label={playing ? "일시정지" : "재생"}>
              {playing ? <Pause size={22}/> : <Play size={22}/>}
            </button>
            <button type="button" className="pe-audio-ctrl-btn" onClick={onPlayNext} aria-label="다음 곡">
              <SkipForward size={20}/>
            </button>
            <button
              type="button"
              className={`pe-audio-ctrl-btn${repeatMode !== "off" ? " pe-audio-ctrl-btn--active" : ""}`}
              onClick={onCycleRepeat}
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
              onChange={onVolumeChange}
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
            <span>{trackCount}곡</span>
          </button>
        </div>
      </div>
    </div>
  );
});

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
  const activeSrcRef = useRef("");
  const advancingRef = useRef(false);
  const shufflePlayedRef = useRef(new Set());
  const tracksRef = useRef(tracks);
  const currentIndexRef = useRef(currentIndex);
  const onIndexChangeRef = useRef(onIndexChange);
  const onDurationUpdateRef = useRef(onDurationUpdate);

  tracksRef.current = tracks;
  currentIndexRef.current = currentIndex;
  onIndexChangeRef.current = onIndexChange;
  onDurationUpdateRef.current = onDurationUpdate;

  const [playingInternal, setPlayingInternal] = useState(false);
  const playing = playingProp ?? playingInternal;
  const setPlaying = onPlayingChange ?? setPlayingInternal;

  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [displayTrack, setDisplayTrack] = useState(null);

  const getTrackAt = useCallback((index) => {
    const list = tracksRef.current;
    if (!list.length) return null;
    const idx = ((index % list.length) + list.length) % list.length;
    return list[idx] || null;
  }, []);

  const findTrackByUrl = useCallback((url) => {
    if (!url) return null;
    return tracksRef.current.find(t => t.file_url === url) || null;
  }, []);

  const loadTrackAt = useCallback((index, { play = true, notifyParent = true } = {}) => {
    const track = getTrackAt(index);
    const url = track?.file_url || "";
    const el = audioRef.current;
    if (!track || !url || !el) return;

    if (notifyParent && index !== currentIndexRef.current) {
      onIndexChangeRef.current(index);
    }

    if (activeSrcRef.current === url) {
      if (play && el.paused) {
        el.play().catch(() => setPlaying(false));
      }
      return;
    }

    advancingRef.current = true;
    activeSrcRef.current = url;
    el.src = url;
    el.load();
    if (play) {
      el.play().catch(() => setPlaying(false));
    }
  }, [getTrackAt, setPlaying]);

  const playAt = useCallback((index, { notifyParent = true } = {}) => {
    if (!tracksRef.current.length) return;
    loadTrackAt(index, { play: true, notifyParent });
    setPlaying(true);
  }, [loadTrackAt, setPlaying]);

  const playPrev = useCallback(() => {
    if (!tracksRef.current.length) return;
    const el = audioRef.current;
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    playAt(currentIndexRef.current - 1);
  }, [playAt]);

  const playNext = useCallback(() => {
    const list = tracksRef.current;
    if (!list.length || !trackSelected) return;

    if (repeatMode === "one") {
      const el = audioRef.current;
      if (el) {
        el.currentTime = 0;
        el.play().catch(() => setPlaying(false));
      }
      return;
    }

    const next = pickNextTrackIndex(currentIndexRef.current, list.length, {
      shuffle,
      repeatMode,
      shufflePlayed: shufflePlayedRef.current,
    });
    if (next == null) {
      setPlaying(false);
      return;
    }
    if (shuffle) shufflePlayedRef.current.add(next);

    loadTrackAt(next, { play: true, notifyParent: true });
    setPlaying(true);
  }, [trackSelected, shuffle, repeatMode, loadTrackAt, setPlaying]);

  const handleEnded = useCallback(() => {
    playNext();
  }, [playNext]);

  const handleLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    advancingRef.current = false;
    const track = findTrackByUrl(activeSrcRef.current);
    if (track) {
      setDisplayTrack(track);
    }

    const d = el.duration || 0;
    setDuration(d);
    setProgress(el.currentTime);
    if (track?.id && d > 0) {
      onDurationUpdateRef.current?.(track.id, d);
    }
  }, [findTrackByUrl]);

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setProgress(el.currentTime);
    const d = el.duration || 0;
    if (d > 0 && d !== duration) {
      setDuration(d);
    }
    const track = findTrackByUrl(activeSrcRef.current);
    if (track?.id && d > 0) {
      onDurationUpdateRef.current?.(track.id, d);
    }
  }, [duration, findTrackByUrl]);

  useEffect(() => {
    if (!trackSelected) {
      setDisplayTrack(null);
      activeSrcRef.current = "";
      return;
    }
    const track = getTrackAt(currentIndex);
    const url = track?.file_url || "";
    if (!url) return;
    if (activeSrcRef.current !== url) {
      loadTrackAt(currentIndex, { play: playing, notifyParent: false });
    }
  }, [trackSelected, currentIndex, playing, getTrackAt, loadTrackAt]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    prepareBackgroundAudioElement(el);
    el.volume = volume;
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !activeSrcRef.current) return;
    if (playing) {
      if (el.paused) el.play().catch(() => setPlaying(false));
    } else if (!advancingRef.current) {
      el.pause();
    }
  }, [playing, setPlaying]);

  useEffect(() => {
    shufflePlayedRef.current = new Set([currentIndex]);
  }, [shuffle, currentIndex]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const el = audioRef.current;
      if (!document.hidden || !playing || !el || !activeSrcRef.current) return;
      if (el.paused) {
        el.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [playing]);

  const displayTitle = displayTrack
    ? formatAudioDisplayTitle(displayTrack.title)
    : "불러오는 중...";
  const displayCover = displayTrack?.cover_url || null;
  const displayIndex = displayTrack
    ? tracks.findIndex(t => t.id === displayTrack.id)
    : currentIndex;

  const nextIndex = useMemo(() => {
    if (!trackSelected || !tracks.length) return null;
    const baseIndex = displayIndex >= 0 ? displayIndex : currentIndex;
    return pickNextTrackIndex(baseIndex, tracks.length, {
      shuffle,
      repeatMode,
      shufflePlayed: shufflePlayedRef.current,
    });
  }, [trackSelected, tracks.length, displayIndex, currentIndex, shuffle, repeatMode]);

  const nextTrack = nextIndex != null ? tracks[nextIndex] : null;
  const nextTitle = nextTrack ? formatAudioDisplayTitle(nextTrack.title) : null;

  usePeAudioMediaSession({
    enabled: trackSelected && Boolean(displayTrack),
    title: displayTitle,
    coverUrl: displayCover,
    playing,
    progress,
    duration,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onPrevious: playPrev,
    onNext: playNext,
  });

  const togglePlay = useCallback(() => {
    if (!activeSrcRef.current || !trackSelected) return;
    setPlaying(p => !p);
  }, [trackSelected, setPlaying]);

  const onSeek = useCallback((e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setProgress(el.currentTime);
  }, [duration]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode(prev => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  }, []);

  if (!trackSelected) return null;

  return (
    <>
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          if (advancingRef.current || audioRef.current?.ended) return;
          setPlaying(false);
        }}
      />
      <AudioPlayerChrome
        displayTitle={displayTitle}
        displayCover={displayCover}
        nextTitle={nextTitle}
        showTrackNo={tracks.length > 0}
        trackNo={(displayIndex >= 0 ? displayIndex : currentIndex) + 1}
        trackTotal={tracks.length}
        playing={playing}
        shuffle={shuffle}
        repeatMode={repeatMode}
        progress={progress}
        duration={duration}
        volume={volume}
        drawerOpen={drawerOpen}
        trackCount={tracks.length}
        onToggleShuffle={() => setShuffle(s => !s)}
        onPlayPrev={playPrev}
        onTogglePlay={togglePlay}
        onPlayNext={playNext}
        onCycleRepeat={cycleRepeat}
        onSeek={onSeek}
        onVolumeChange={e => setVolume(Number(e.target.value))}
        onToggleDrawer={onToggleDrawer}
      />
    </>
  );
}
