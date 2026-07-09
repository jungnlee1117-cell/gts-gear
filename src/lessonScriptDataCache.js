/** @typedef {"defaults"|"local"|"supabase"} LessonScriptDataSource */

/** @type {import("./lessonScriptDataTypes.js").LessonScriptAdminPatch | null} */
let cachedPatch = null;

/** @type {LessonScriptDataSource} */
let dataSource = "defaults";

let loadPromise = null;

export function getCachedAdminPatch() {
  return cachedPatch;
}

/** @param {LessonScriptDataSource} source */
export function setCachedAdminPatch(patch, source) {
  cachedPatch = patch;
  dataSource = source;
}

export function getAdminDataSource() {
  return dataSource;
}

export function getAdminLoadPromise() {
  return loadPromise;
}

export function setAdminLoadPromise(promise) {
  loadPromise = promise;
}

export function invalidateAdminDataCache() {
  cachedPatch = null;
  dataSource = "defaults";
  loadPromise = null;
}
