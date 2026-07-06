import { useEffect, useRef } from "react";
import { AudioLines, MoreVertical, Trash2, X } from "lucide-react";
import { formatAudioDisplayTitle, formatDuration } from "./peMediaUtils.js";

export default function PlaylistDrawer({
  open,
  onClose,
  tracks = [],
  currentIndex,
  playing,
  onJumpTo,
  onClear,
  durationById = {},
}) {
  const activeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, currentIndex]);

  if (!open) return null;

  return (
    <>
      <button type="button" className="pe-audio-drawer-scrim" onClick={onClose} aria-label="재생 목록 닫기"/>
      <aside className="pe-audio-drawer" aria-label="재생 목록">
        <div className="pe-audio-drawer-head">
          <h2 className="pe-audio-drawer-title">재생 목록 ({tracks.length})</h2>
          <button type="button" className="pe-audio-drawer-close" onClick={onClose} aria-label="닫기">
            <X size={18}/>
          </button>
        </div>

        <ol className="pe-audio-drawer-list">
          {tracks.map((track, idx) => {
            const isCurrent = idx === currentIndex;
            const isPlaying = isCurrent && playing;
            const displayTitle = formatAudioDisplayTitle(track.title);
            const dur = durationById[track.id];
            return (
              <li
                key={track.id}
                ref={isCurrent ? activeRef : null}
                className={[
                  "pe-audio-drawer-item",
                  isPlaying && "pe-audio-drawer-item--playing",
                  isCurrent && !playing && "pe-audio-drawer-item--active",
                ].filter(Boolean).join(" ")}
              >
                <button type="button" className="pe-audio-drawer-item-main" onClick={() => onJumpTo(idx)}>
                  <span className={`pe-audio-drawer-num${isPlaying ? " pe-audio-drawer-num--playing" : ""}`}>
                    {isPlaying ? <AudioLines size={14}/> : idx + 1}
                  </span>
                  <div className="pe-audio-drawer-thumb">
                    {track.cover_url ? (
                      <img src={track.cover_url} alt=""/>
                    ) : (
                      <span aria-hidden>♪</span>
                    )}
                  </div>
                  <span className="pe-audio-drawer-track-title">{displayTitle}</span>
                  <span className="pe-audio-drawer-duration">{dur ? formatDuration(dur) : "--:--"}</span>
                </button>
                <button type="button" className="pe-audio-icon-btn pe-audio-drawer-more" aria-label={`${displayTitle} 더보기`}>
                  <MoreVertical size={16}/>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="pe-audio-drawer-foot">
          <button type="button" className="pe-audio-drawer-clear" onClick={onClear}>
            <Trash2 size={15}/>
            목록 비우기
          </button>
        </div>
      </aside>
    </>
  );
}
