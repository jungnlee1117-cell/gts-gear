function sanitizeFileName(name) {
  return String(name || "audio").replace(/[<>:"/\\|?*\n\r]/g, "_").trim() || "audio";
}

export function getAudioDownloadFileName(track) {
  if (track?.file_name) return track.file_name;
  const ext = track?.file_url?.match(/\.(mp3|wav)(\?|$)/i)?.[1]?.toLowerCase() || "mp3";
  return `${sanitizeFileName(track?.title)}.${ext}`;
}

export async function downloadAudioTrack(track) {
  const url = track?.file_url;
  if (!url) throw new Error("파일 URL이 없습니다.");

  const fileName = getAudioDownloadFileName(track);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadAudioTracks(tracks, { onProgress, delayMs = 400 } = {}) {
  for (let i = 0; i < tracks.length; i += 1) {
    await downloadAudioTrack(tracks[i]);
    onProgress?.(i + 1, tracks.length);
    if (i < tracks.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
