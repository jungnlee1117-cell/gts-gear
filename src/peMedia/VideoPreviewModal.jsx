import { ExternalLink, X } from "lucide-react";
import {
  buildYoutubeWatchUrl,
  getYoutubeEmbedUrl,
  getYoutubeVideoIdFromResource,
  isYoutubeResource,
} from "./peMediaUtils.js";

export default function VideoPreviewModal({ resource, onClose }) {
  const youtubeVideoId = getYoutubeVideoIdFromResource(resource);
  const isYoutube = isYoutubeResource(resource);

  return (
    <div className="pe-res-overlay" onClick={onClose}>
      <div className="pe-res-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="pe-res-preview-header">
          <h2>{resource.title}</h2>
          <button type="button" onClick={onClose} className="pe-res-modal-close" aria-label="닫기"><X size={18}/></button>
        </div>
        <div className="pe-res-preview-body">
          {isYoutube && youtubeVideoId ? (
            <div className="pe-res-preview-youtube-wrap">
              <iframe
                title={resource.title}
                src={getYoutubeEmbedUrl(youtubeVideoId)}
                className="pe-res-preview-youtube"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <a href={resource.file_url || buildYoutubeWatchUrl(youtubeVideoId)} target="_blank" rel="noopener noreferrer" className="pe-res-youtube-open-btn">
                <ExternalLink size={15}/> 유튜브에서 열기
              </a>
            </div>
          ) : (
            <video controls src={resource.file_url} className="pe-res-preview-video"/>
          )}
        </div>
      </div>
    </div>
  );
}
