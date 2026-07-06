import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Video, Music } from "lucide-react";
import VideoMediaTab from "./VideoMediaTab.jsx";
import AudioMediaTab from "./AudioMediaTab.jsx";

export default function PeMediaLibrary({ me, resources, loading, onRefresh }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState(tabParam === "audio" ? "audio" : "video");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTab(tabParam === "audio" ? "audio" : "video");
  }, [tabParam]);

  const switchTab = (next) => {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("category", "videos");
    if (next === "audio") nextParams.set("tab", "audio");
    else nextParams.delete("tab");
    setSearchParams(nextParams, { replace: true });
  };

  const title = useMemo(
    () => (tab === "audio" ? "음원 자료실" : "영상 자료실"),
    [tab],
  );

  return (
    <div className={`pe-media-library${tab === "audio" ? " pe-media-library--audio" : ""}`}>
      <div className="pe-media-library-head">
        <div>
          <h1 className="pe-res-list-title">영상 · 음원 자료실</h1>
          <p className="pe-res-page-desc">{title} — 수업에 필요한 영상과 음원을 바로 재생하세요.</p>
        </div>
      </div>

      <div className="pe-media-tabs" role="tablist" aria-label="자료 유형">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "video"}
          className={`pe-media-tab-btn${tab === "video" ? " active" : ""}`}
          onClick={() => switchTab("video")}
        >
          <Video size={16} aria-hidden/> 영상
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "audio"}
          className={`pe-media-tab-btn${tab === "audio" ? " active" : ""}`}
          onClick={() => switchTab("audio")}
        >
          <Music size={16} aria-hidden/> 음원
        </button>
      </div>

      <div className="pe-media-search">
        <Search size={18} strokeWidth={2} color="#94a3b8"/>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === "audio" ? "곡 제목·태그 검색" : "영상 제목·태그 검색"}
        />
      </div>

      {tab === "video" ? (
        <VideoMediaTab me={me} resources={resources} loading={loading} onRefresh={onRefresh} search={search}/>
      ) : (
        <AudioMediaTab me={me} resources={resources} loading={loading} onRefresh={onRefresh} search={search}/>
      )}
    </div>
  );
}
