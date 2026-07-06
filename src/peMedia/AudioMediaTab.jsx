import { useEffect, useMemo, useState } from "react";
import { Download, MoreVertical, Pause, Pencil, Play, Trash2, Upload } from "lucide-react";
import { PE_ADMIN, formatAudioDisplayTitle, formatDuration, isAudioMediaResource } from "./peMediaUtils.js";
import { deleteMediaResource } from "./peMediaApi.js";
import { downloadAudioTrack, downloadAudioTracks } from "./peMediaDownload.js";
import AudioPlayer from "./AudioPlayer.jsx";
import PlaylistDrawer from "./PlaylistDrawer.jsx";
import AudioUploadModal from "./AudioUploadModal.jsx";
import AudioEditModal from "./AudioEditModal.jsx";

export default function AudioMediaTab({ me, resources, loading, onRefresh, search = "" }) {
  const [showUpload, setShowUpload] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [playlistTracks, setPlaylistTracks] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [playing, setPlaying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuTrackId, setMenuTrackId] = useState(null);
  const [durationById, setDurationById] = useState({});
  const admin = PE_ADMIN(me);

  const tracks = useMemo(() => {
    let list = resources.filter(isAudioMediaResource);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q)
        || r.tags?.some(t => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [resources, search]);

  const playerTracks = playlistTracks ?? tracks;
  const trackSelected = currentIndex !== null;
  const playerIndex = trackSelected && playerTracks.length
    ? Math.min(currentIndex, playerTracks.length - 1)
    : 0;
  const currentTrack = trackSelected ? playerTracks[playerIndex] : null;

  useEffect(() => {
    if (currentIndex !== null && currentIndex >= playerTracks.length) {
      setCurrentIndex(playerTracks.length ? playerTracks.length - 1 : null);
      setPlaying(false);
    }
  }, [playerTracks.length, currentIndex]);

  const selectedTracks = useMemo(() => {
    const byId = Object.fromEntries(tracks.map(track => [track.id, track]));
    return selectedOrder.map(id => byId[id]).filter(Boolean);
  }, [tracks, selectedOrder]);

  const selectedIdSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);
  const allSelected = tracks.length > 0 && selectedTracks.length === tracks.length;

  const toggleSelect = (id) => {
    setSelectedOrder(prev => (
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedOrder([]);
      return;
    }
    setSelectedOrder(tracks.map(track => track.id));
  };

  const handlePlaySelected = () => {
    if (!selectedTracks.length) return;
    setPlaylistTracks([...selectedTracks]);
    setCurrentIndex(0);
    setPlaying(true);
    setDrawerOpen(false);
  };

  const handleDownloadOne = async (track) => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress("");
    try {
      await downloadAudioTrack(track);
    } catch (e) {
      alert(`"${track.title}" 다운로드 오류: ${e.message}`);
    } finally {
      setDownloading(false);
      setDownloadProgress("");
    }
  };

  const handleDownloadSelected = async () => {
    if (!selectedTracks.length || downloading) return;
    setDownloading(true);
    setDownloadProgress(`0/${selectedTracks.length} 다운로드 중...`);
    try {
      await downloadAudioTracks(selectedTracks, {
        onProgress: (done, total) => setDownloadProgress(`${done}/${total} 다운로드 중...`),
      });
    } catch (e) {
      alert("다운로드 오류: " + e.message);
    } finally {
      setDownloading(false);
      setDownloadProgress("");
    }
  };

  const handleDelete = async (res) => {
    if (!confirm(`"${res.title}" 음원을 삭제하시겠습니까?`)) return;
    try {
      await deleteMediaResource(res);
      setSelectedOrder(prev => prev.filter(id => id !== res.id));
      if (playlistTracks) {
        const nextPlaylist = playlistTracks.filter(t => t.id !== res.id);
        setPlaylistTracks(nextPlaylist.length ? nextPlaylist : null);
      }
      onRefresh();
    } catch (e) {
      alert("삭제 오류: " + e.message);
    }
  };

  const handlePlayTrack = (idx) => {
    const track = tracks[idx];
    if (playing && currentTrack?.id === track.id) {
      setPlaying(false);
      return;
    }
    setPlaylistTracks(null);
    setCurrentIndex(idx);
    setPlaying(true);
  };

  const handleJumpTo = (idx) => {
    setCurrentIndex(idx);
    setPlaying(true);
  };

  const handleClearPlaylist = () => {
    setPlaylistTracks(null);
    setCurrentIndex(null);
    setPlaying(false);
    setDrawerOpen(false);
  };

  const handleDurationUpdate = (trackId, dur) => {
    setDurationById(prev => {
      if (prev[trackId] === dur) return prev;
      return { ...prev, [trackId]: dur };
    });
  };

  return (
    <div className={`pe-media-tab pe-media-tab--audio${trackSelected ? " pe-media-tab--player-visible" : ""}${drawerOpen ? " pe-media-tab--drawer-open" : ""}`}>
      <div className="pe-audio-toolbar">
        <div className="pe-audio-toolbar-left">
          <label className="pe-audio-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={downloading || tracks.length === 0}
              onChange={toggleSelectAll}
            />
            전체 선택
          </label>
          <span className="pe-audio-select-count">{selectedTracks.length}곡 선택됨</span>
        </div>
        <div className="pe-audio-toolbar-right">
          <button
            type="button"
            className="pe-audio-btn pe-audio-btn--play"
            disabled={selectedTracks.length === 0}
            onClick={handlePlaySelected}
          >
            <Play size={15}/>
            선택 재생 ({selectedTracks.length})
          </button>
          <button
            type="button"
            className="pe-audio-btn pe-audio-btn--download"
            disabled={downloading || selectedTracks.length === 0}
            onClick={handleDownloadSelected}
          >
            <Download size={15}/>
            선택 다운로드 ({selectedTracks.length})
          </button>
          {admin ? (
            <button type="button" className="pe-res-upload-btn" onClick={() => setShowUpload(true)}>
              <Upload size={16}/> 음원 업로드
            </button>
          ) : null}
        </div>
      </div>

      {downloadProgress ? (
        <p className="pe-audio-download-progress" aria-live="polite">{downloadProgress}</p>
      ) : null}

      {loading ? (
        <div className="pe-res-empty">불러오는 중...</div>
      ) : tracks.length === 0 ? (
        <div className="pe-res-empty pe-res-empty-box">등록된 음원이 없습니다</div>
      ) : (
        <>
          <ul className="pe-audio-track-list">
            {tracks.map((track, idx) => {
              const isPlaying = playing && currentTrack?.id === track.id;
              const displayTitle = formatAudioDisplayTitle(track.title);
              const dur = durationById[track.id];
              const menuOpen = menuTrackId === track.id;
              return (
                <li
                  key={track.id}
                  className={[
                    "pe-audio-track-row",
                    selectedIdSet.has(track.id) && "pe-audio-track-row--selected",
                    isPlaying && "pe-audio-track-row--playing",
                  ].filter(Boolean).join(" ")}
                >
                  <label className="pe-audio-track-check" aria-label={`${displayTitle} 선택`}>
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(track.id)}
                      disabled={downloading}
                      onChange={() => toggleSelect(track.id)}
                    />
                  </label>
                  <span className={`pe-audio-track-num${isPlaying ? " pe-audio-track-num--playing" : ""}`}>{idx + 1}</span>
                  <div className="pe-audio-track-thumb">
                    {track.cover_url ? (
                      <img src={track.cover_url} alt=""/>
                    ) : (
                      <span aria-hidden>♪</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="pe-audio-track-title-btn"
                    onClick={() => handlePlayTrack(idx)}
                  >
                    {displayTitle}
                  </button>
                  <span className="pe-audio-track-duration">{dur ? formatDuration(dur) : "--:--"}</span>
                  <div className="pe-audio-track-actions">
                    <button
                      type="button"
                      className="pe-audio-icon-btn"
                      onClick={() => handlePlayTrack(idx)}
                      aria-label={isPlaying ? `${displayTitle} 일시정지` : `${displayTitle} 재생`}
                    >
                      {isPlaying ? <Pause size={15}/> : <Play size={15}/>}
                    </button>
                    <button
                      type="button"
                      className="pe-audio-icon-btn"
                      disabled={downloading}
                      onClick={() => handleDownloadOne(track)}
                      aria-label={`${displayTitle} 다운로드`}
                    >
                      <Download size={15}/>
                    </button>
                    <div className="pe-audio-track-menu-wrap">
                      <button
                        type="button"
                        className="pe-audio-icon-btn"
                        onClick={() => setMenuTrackId(menuOpen ? null : track.id)}
                        aria-label={`${displayTitle} 더보기`}
                        aria-expanded={menuOpen}
                      >
                        <MoreVertical size={15}/>
                      </button>
                      {menuOpen ? (
                        <>
                          <button type="button" className="pe-audio-menu-scrim" onClick={() => setMenuTrackId(null)} aria-label="메뉴 닫기"/>
                          <div className="pe-audio-menu" role="menu">
                            {admin ? (
                              <>
                                <button type="button" role="menuitem" onClick={() => { setEditTarget(track); setMenuTrackId(null); }}>
                                  <Pencil size={14}/> 수정
                                </button>
                                <button type="button" role="menuitem" className="pe-audio-menu-item--danger" onClick={() => { handleDelete(track); setMenuTrackId(null); }}>
                                  <Trash2 size={14}/> 삭제
                                </button>
                              </>
                            ) : (
                              <button type="button" role="menuitem" onClick={() => { handleDownloadOne(track); setMenuTrackId(null); }}>
                                <Download size={14}/> 다운로드
                              </button>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="pe-audio-list-footer">{tracks.length}곡 중 {selectedTracks.length}곡 선택됨</p>
        </>
      )}

      <AudioPlayer
        tracks={playerTracks}
        currentIndex={playerIndex}
        onIndexChange={setCurrentIndex}
        playing={playing}
        onPlayingChange={setPlaying}
        trackSelected={trackSelected}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen(o => !o)}
        onDurationUpdate={handleDurationUpdate}
      />

      <PlaylistDrawer
        open={drawerOpen && trackSelected}
        onClose={() => setDrawerOpen(false)}
        tracks={playerTracks}
        currentIndex={playerIndex}
        playing={playing}
        onJumpTo={handleJumpTo}
        onClear={handleClearPlaylist}
        durationById={durationById}
      />

      {showUpload ? (
        <AudioUploadModal me={me} onClose={() => setShowUpload(false)} onSaved={onRefresh}/>
      ) : null}
      {editTarget ? (
        <AudioEditModal resource={editTarget} onClose={() => setEditTarget(null)} onSaved={onRefresh}/>
      ) : null}
    </div>
  );
}
