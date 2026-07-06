import { useEffect, useMemo, useState } from "react";
import { Download, Music, Pause, Pencil, Play, Trash2, Upload } from "lucide-react";
import { PE_ADMIN, isAudioMediaResource, pickNextTrackIndex } from "./peMediaUtils.js";
import { deleteMediaResource } from "./peMediaApi.js";
import { downloadAudioTrack, downloadAudioTracks } from "./peMediaDownload.js";
import AudioPlayer from "./AudioPlayer.jsx";
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
  const isPlaylistMode = playlistTracks !== null;
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

  const nextListTrack = useMemo(() => {
    if (!trackSelected || !playing || playerTracks.length <= 1) return null;
    const nextIdx = pickNextTrackIndex(playerIndex, playerTracks.length, { repeatMode: "all" });
    return nextIdx != null ? playerTracks[nextIdx] : null;
  }, [trackSelected, playing, playerTracks, playerIndex]);

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

  return (
    <div className={`pe-media-tab pe-media-tab--audio${isPlaylistMode ? " pe-media-tab--playlist" : ""}`}>
      <div className="pe-media-tab-header">
        <p className="pe-media-tab-desc">MP3/WAV 음원을 재생·다운로드할 수 있습니다.</p>
        <div className="pe-media-tab-header-actions">
          {tracks.length > 0 ? (
            <>
              <button
                type="button"
                className="pe-media-audio-bulk-play-btn"
                disabled={selectedTracks.length === 0}
                onClick={handlePlaySelected}
              >
                <Play size={16}/>
                선택 재생 ({selectedTracks.length})
              </button>
              <button
                type="button"
                className="pe-media-audio-bulk-download-btn"
                disabled={downloading || selectedTracks.length === 0}
                onClick={handleDownloadSelected}
              >
                <Download size={16}/>
                선택 다운로드 ({selectedTracks.length})
              </button>
            </>
          ) : null}
          {admin ? (
            <button type="button" className="pe-res-upload-btn" onClick={() => setShowUpload(true)}>
              <Upload size={16}/> 음원 업로드
            </button>
          ) : null}
        </div>
      </div>

      {downloadProgress ? (
        <p className="pe-media-audio-download-progress" aria-live="polite">{downloadProgress}</p>
      ) : null}

      {loading ? (
        <div className="pe-res-empty">불러오는 중...</div>
      ) : tracks.length === 0 ? (
        <div className="pe-res-empty pe-res-empty-box">등록된 음원이 없습니다</div>
      ) : (
        <>
          <div className="pe-media-audio-toolbar">
            <label className="pe-media-audio-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={downloading}
                onChange={toggleSelectAll}
              />
              전체 선택
            </label>
            <span className="pe-media-audio-select-count">{selectedTracks.length}곡 선택됨</span>
          </div>
          <ul className="pe-media-audio-list">
            {tracks.map((track, idx) => {
              const isPlaying = playing && currentTrack?.id === track.id;
              return (
              <li
                key={track.id}
                className={`pe-media-audio-item${isPlaying ? " pe-media-audio-item--active" : ""}${selectedIdSet.has(track.id) ? " pe-media-audio-item--selected" : ""}`}
              >
                <label className="pe-media-audio-check" aria-label={`${track.title} 선택`}>
                  <input
                    type="checkbox"
                    checked={selectedIdSet.has(track.id)}
                    disabled={downloading}
                    onChange={() => toggleSelect(track.id)}
                  />
                </label>
                <span className={`pe-media-audio-num${isPlaying ? " pe-media-audio-num--active" : ""}`} aria-hidden>
                  {idx + 1}
                </span>
                <button
                  type="button"
                  className="pe-media-audio-play-hit"
                  onClick={() => handlePlayTrack(idx)}
                  aria-label={`${track.title} 재생`}
                >
                  <div className="pe-media-audio-art">
                    {track.cover_url ? (
                      <img src={track.cover_url} alt=""/>
                    ) : (
                      <Music size={20} aria-hidden/>
                    )}
                  </div>
                  <div className="pe-media-audio-meta">
                    <div className="pe-media-audio-title">{track.title}</div>
                    {isPlaying && nextListTrack ? (
                      <div className="pe-media-audio-next">다음 곡: {nextListTrack.title}</div>
                    ) : null}
                    <div className="pe-media-audio-tags">
                      {(track.tags || []).map(t => (
                        <span key={t} className="pe-res-meta-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                </button>
                <div className="pe-media-audio-actions">
                  <button
                    type="button"
                    className="pe-res-action-btn pe-res-action-preview"
                    onClick={() => handlePlayTrack(idx)}
                    aria-label={isPlaying ? `${track.title} 일시정지` : `${track.title} 재생`}
                    title={isPlaying ? "일시정지" : "재생"}
                  >
                    {isPlaying ? <Pause size={15}/> : <Play size={15}/>}
                  </button>
                  <button
                    type="button"
                    className="pe-res-action-btn pe-res-action-download"
                    disabled={downloading}
                    onClick={() => handleDownloadOne(track)}
                    aria-label={`${track.title} 다운로드`}
                    title="다운로드"
                  >
                    <Download size={15}/>
                  </button>
                  {admin ? (
                    <>
                      <button type="button" className="pe-res-action-btn pe-res-action-edit" onClick={() => setEditTarget(track)}>
                        <Pencil size={14}/>
                      </button>
                      <button type="button" className="pe-res-action-btn pe-res-action-delete" onClick={() => handleDelete(track)}>
                        <Trash2 size={14}/>
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );})}
          </ul>
        </>
      )}

      <AudioPlayer
        tracks={playerTracks}
        currentIndex={playerIndex}
        onIndexChange={setCurrentIndex}
        playing={playing}
        onPlayingChange={setPlaying}
        trackSelected={trackSelected}
        showPlaylist={isPlaylistMode}
        playlistLabel={isPlaylistMode ? `선택 재생 목록 (${playerTracks.length}곡)` : null}
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
