export const PE_ADMIN = (u) => u?.role === "superadmin" || u?.role === "admin";

export const AUDIO_ACCEPT = ".mp3,.wav";
export const VIDEO_ACCEPT = "video/*";

export function parseYoutubeVideoId(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      return u.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export function buildYoutubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYoutubeThumbnail(videoId, quality = "hqdefault") {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

export function getYoutubeEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function isYoutubeResource(res) {
  if (!res) return false;
  if (res.file_type === "youtube") return true;
  return Boolean(parseYoutubeVideoId(res.file_url));
}

export function getYoutubeVideoIdFromResource(res) {
  if (!res) return null;
  return parseYoutubeVideoId(res.file_url);
}

export function isVideoMediaResource(res) {
  if (!res) return false;
  return res.file_type === "video" || isYoutubeResource(res);
}

export function isAudioMediaResource(res) {
  return res?.file_type === "audio";
}

export function canEditResource(me, res) {
  if (!me || !res) return false;
  if (PE_ADMIN(me)) return true;
  return res.author_id === me.id;
}

export function getStoragePath(fileUrl) {
  if (!fileUrl) return null;
  try {
    const url = new URL(fileUrl);
    const parts = url.pathname.split("/pe-resources/");
    if (parts[1]) return decodeURIComponent(parts[1]);
  } catch { /* ignore */ }
  const marker = "/pe-resources/";
  const i = fileUrl.indexOf(marker);
  if (i >= 0) return decodeURIComponent(fileUrl.slice(i + marker.length).split("?")[0]);
  return null;
}

export function formatAudioDisplayTitle(title) {
  if (!title) return "";
  let text = String(title).trim();
  const decorPattern = /^[\s\uFE0F]*(?:🎵|🎶|♪|♫|🎧|🎼|🔊|🎤)+[\s]*/u;
  let prev;
  do {
    prev = text;
    text = text.replace(decorPattern, "").trim();
  } while (text !== prev);
  return text || String(title).trim();
}

export function pickNextTrackIndex(currentIndex, total, { shuffle = false, repeatMode = "off", shufflePlayed } = {}) {
  if (total <= 0) return null;
  if (repeatMode === "one") return currentIndex;
  let next = currentIndex + 1;
  if (shuffle) {
    const played = shufflePlayed ?? new Set([currentIndex]);
    const remaining = [];
    for (let i = 0; i < total; i += 1) {
      if (i !== currentIndex && !played.has(i)) remaining.push(i);
    }
    if (!remaining.length) next = (currentIndex + 1) % total;
    else next = remaining[Math.floor(Math.random() * remaining.length)];
  } else if (next >= total) {
    if (repeatMode === "all") next = 0;
    else return null;
  }
  return next;
}

export function detectAudioFile(file) {
  const ext = String(file?.name || "").split(".").pop()?.toLowerCase();
  return file?.type?.startsWith("audio/") || ext === "mp3" || ext === "wav";
}

export function detectVideoFile(file) {
  return file?.type?.startsWith("video/");
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
