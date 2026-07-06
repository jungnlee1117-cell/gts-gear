import { useMemo, useState } from "react";
import { Eye, ExternalLink, Pencil, Trash2, Upload } from "lucide-react";
import {
  PE_ADMIN,
  canEditResource,
  getYoutubeThumbnail,
  getYoutubeVideoIdFromResource,
  isYoutubeResource,
} from "./peMediaUtils.js";
import { deleteMediaResource } from "./peMediaApi.js";
import VideoUploadModal from "./VideoUploadModal.jsx";
import VideoEditModal from "./VideoEditModal.jsx";
import VideoPreviewModal from "./VideoPreviewModal.jsx";

export default function VideoMediaTab({ me, resources, loading, onRefresh, search = "" }) {
  const [showUpload, setShowUpload] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);
  const admin = PE_ADMIN(me);

  const videos = useMemo(() => {
    let list = resources.filter(r => r.file_type === "video" || isYoutubeResource(r));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q)
        || r.description?.toLowerCase().includes(q)
        || r.tags?.some(t => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [resources, search]);

  const handleDelete = async (res) => {
    if (!confirm(`"${res.title}" 영상을 삭제하시겠습니까?`)) return;
    try {
      await deleteMediaResource(res);
      onRefresh();
    } catch (e) {
      alert("삭제 오류: " + e.message);
    }
  };

  return (
    <div className="pe-media-tab">
      <div className="pe-media-tab-header">
        <p className="pe-media-tab-desc">유튜브 링크 및 영상 파일을 재생할 수 있습니다.</p>
        {admin ? (
          <button type="button" className="pe-res-upload-btn" onClick={() => setShowUpload(true)}>
            <Upload size={16}/> 영상 업로드
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="pe-res-empty">불러오는 중...</div>
      ) : videos.length === 0 ? (
        <div className="pe-res-empty pe-res-empty-box">등록된 영상이 없습니다</div>
      ) : (
        <div className="pe-media-video-grid">
          {videos.map(res => {
            const youtube = isYoutubeResource(res);
            const videoId = youtube ? getYoutubeVideoIdFromResource(res) : null;
            return (
              <article key={res.id} className={`pe-media-video-card${youtube ? " pe-media-video-card--youtube" : ""}`}>
                <button
                  type="button"
                  className="pe-media-video-thumb"
                  onClick={() => setPreviewTarget(res)}
                  aria-label={`${res.title} 재생`}
                >
                  {videoId ? (
                    <img src={getYoutubeThumbnail(videoId, "mqdefault")} alt=""/>
                  ) : (
                    <div className="pe-media-video-thumb-fallback">영상</div>
                  )}
                  <span className="pe-media-video-play-badge">▶</span>
                </button>
                <div className="pe-media-video-body">
                  <h3 className="pe-media-video-title">{res.title}</h3>
                  {res.description ? <p className="pe-media-video-desc">{res.description}</p> : null}
                  <div className="pe-res-resource-meta">
                    {(res.tags || []).map(t => (
                      <span key={t} className="pe-res-meta-tag pe-res-meta-tag-accent">{t}</span>
                    ))}
                  </div>
                  <div className="pe-media-video-actions">
                    <button type="button" className="pe-res-action-btn pe-res-action-preview" onClick={() => setPreviewTarget(res)}>
                      <Eye size={14}/> 재생
                    </button>
                    {youtube && res.file_url ? (
                      <a href={res.file_url} target="_blank" rel="noopener noreferrer" className="pe-res-download-btn pe-res-youtube-open-link">
                        <ExternalLink size={15}/> 유튜브
                      </a>
                    ) : null}
                    {canEditResource(me, res) ? (
                      <>
                        <button type="button" className="pe-res-action-btn pe-res-action-edit" onClick={() => setEditTarget(res)}>
                          <Pencil size={14}/> 수정
                        </button>
                        <button type="button" className="pe-res-action-btn pe-res-action-delete" onClick={() => handleDelete(res)}>
                          <Trash2 size={14}/> 삭제
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showUpload ? (
        <VideoUploadModal me={me} onClose={() => setShowUpload(false)} onSaved={onRefresh}/>
      ) : null}
      {editTarget ? (
        <VideoEditModal resource={editTarget} onClose={() => setEditTarget(null)} onSaved={onRefresh}/>
      ) : null}
      {previewTarget ? (
        <VideoPreviewModal resource={previewTarget} onClose={() => setPreviewTarget(null)}/>
      ) : null}
    </div>
  );
}
