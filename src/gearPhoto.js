const PHOTO_POSITION_PRESETS = {
  "center top": "50% 0%",
  "center center": "50% 50%",
  "center bottom": "50% 100%",
  "left center": "0% 50%",
  "right center": "100% 50%",
};

export function itemPhotoPosition(item) {
  const raw = item?.photo_position || "50% 50%";
  return PHOTO_POSITION_PRESETS[raw] || raw;
}

export function itemPhotoStyle(item, extra = {}) {
  return {
    objectFit: "cover",
    objectPosition: itemPhotoPosition(item),
    ...extra,
  };
}
