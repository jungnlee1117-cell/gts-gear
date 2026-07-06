import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pause, Play, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2,
} from "lucide-react";
import { formatDuration, pickNextTrackIndex } from "./peMediaUtils.js";

export default function AudioPlayer({
  tracks = [],
  currentIndex,
  onIndexChange,
  coverUrl,
  title,
  tags = [],
  playing: playingProp,
  onPlayingChange,
  trackSelected = true,
  showPlaylist = false,
  playlistLabel = null,
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

  const current = trackSelected ? (tracks[currentIndex] || null) : null;
  const src = current?.file_url || "";

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
  }, [tracks.length, onIndexChange]);

  const playPrev = () => {
    if (!tracks.length) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    playAt(currentIndex - 1);
  };

  const playNext = useCallback(() => {
    if (!tracks.length || !trackSelected) return;
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
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
    playAt(next);
  }, [tracks.length, trackSelected, currentIndex, shuffle, repeatMode, playAt, setPlaying]);

  useEffect(() => {
    shufflePlayedRef.current = new Set([currentIndex]);
  }, [shuffle, currentIndex]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    if (playing && src) {
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [playing, src, volume]);

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
    setDuration(el.duration || 0);
  };

  const onSeek = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setProgress(el.currentTime);
  };

  const jumpToTrack = (index) => {
    if (!tracks.length) return;
    onIndexChange(index);
    setPlaying(true);
  };

  const displayCover = coverUrl || current?.cover_url;
  const displayTitle = title || current?.title || "재생할 곡을 선택하세요";
  const displayTags = tags.length ? tags : (current?.tags || []);
  const showTrackNo = trackSelected && tracks.length > 0;

  return (
    <div className={`pe-media-player${showPlaylist ? " pe-media-player--with-playlist" : ""}`}>
      <audio
        ref={audioRef}
        src={src || undefined}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onEnded={playNext}
      />

      <div className="pe-media-player-main">
        <div className="pe-media-player-art">
          {displayCover ? (
            <img src={displayCover} alt="" className="pe-media-player-art-img"/>
          ) : (
            <div className="pe-media-player-art-placeholder" aria-hidden>♪</div>
          )}
        </div>
        <div className="pe-media-player-info">
          <div className="pe-media-player-title">{displayTitle}</div>
          {displayTags.length > 0 ? (
            <div className="pe-media-player-tags">
              {displayTags.map(t => (
                <span key={t} className="pe-media-player-tag">{t}</span>
              ))}
            </div>
          ) : null}
          <div className="pe-media-player-track-no">
            {showTrackNo ? `${currentIndex + 1} / ${tracks.length}` : "—"}
          </div>
          {nextTrack ? (
            <div className="pe-media-player-next">
              다음 곡: <span>{nextTrack.title}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pe-media-player-progress" onClick={onSeek} role="slider" aria-valuemin={0} aria-valuemax={duration || 0} aria-valuenow={progress}>
        <div
          className="pe-media-player-progress-fill"
          style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}
        />
      </div>
      <div className="pe-media-player-times">
        <span>{formatDuration(progress)}</span>
        <span>{formatDuration(duration)}</span>
      </div>

      <div className="pe-media-player-controls">
        <button
          type="button"
          className={`pe-media-player-btn pe-media-player-btn--ghost${shuffle ? " active" : ""}`}
          onClick={() => setShuffle(s => !s)}
          aria-label="셔플"
        >
          <Shuffle size={18}/>
        </button>
        <button type="button" className="pe-media-player-btn" onClick={playPrev} aria-label="이전 곡">
          <SkipBack size={22}/>
        </button>
        <button type="button" className="pe-media-player-btn pe-media-player-btn--play" onClick={togglePlay} aria-label={playing ? "일시정지" : "재생"}>
          {playing ? <Pause size={26}/> : <Play size={26}/>}
        </button>
        <button type="button" className="pe-media-player-btn" onClick={playNext} aria-label="다음 곡">
          <SkipForward size={22}/>
        </button>
        <button
          type="button"
          className={`pe-media-player-btn pe-media-player-btn--ghost${repeatMode !== "off" ? " active" : ""}`}
          onClick={cycleRepeat}
          aria-label="반복"
        >
          {repeatMode === "one" ? <Repeat1 size={18}/> : <Repeat size={18}/>}
        </button>
      </div>

      <div className="pe-media-player-volume">
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

      {showPlaylist && tracks.length > 0 ? (
        <div className="pe-media-player-playlist">
          <div className="pe-media-player-playlist-head">
            {playlistLabel || `재생 목록 (${tracks.length}곡)`}
          </div>
          <ol className="pe-media-player-playlist-list">
            {tracks.map((track, idx) => (
              <li key={track.id}>
                <button
                  type="button"
                  className={`pe-media-player-playlist-item${idx === currentIndex ? " pe-media-player-playlist-item--active" : ""}${idx === currentIndex && playing ? " pe-media-player-playlist-item--playing" : ""}`}
                  onClick={() => jumpToTrack(idx)}
                >
                  <span className="pe-media-player-playlist-num">{idx + 1}</span>
                  <span className="pe-media-player-playlist-title">{track.title}</span>
                  {idx === currentIndex && playing ? (
                    <span className="pe-media-player-playlist-now" aria-hidden>재생 중</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
