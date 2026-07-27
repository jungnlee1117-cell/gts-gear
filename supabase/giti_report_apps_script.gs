/**
 * 지티 리포트 → Google Docs 저장 (Apps Script 웹앱)
 *
 * 배포:
 * 1. script.google.com 새 프로젝트
 * 2. 아래 코드 붙여넣기 (SCRIPT_SECRET을 Edge secret과 동일하게)
 * 3. 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 계정: 나
 *    - 액세스 권한: 모든 사용자
 * 4. 웹앱 URL을 Supabase secret GITI_APPS_SCRIPT_URL 에 저장
 *
 * 폴더 ID 기본값: 1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0
 * (배포 계정 Google Drive에서 해당 폴더에 접근 가능해야 함)
 */

var FOLDER_ID_DEFAULT = "1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0";
/** Edge Function GITI_APPS_SCRIPT_SECRET 과 동일하게 설정 (비워두면 검증 생략) */
var SCRIPT_SECRET = "";

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    if (SCRIPT_SECRET) {
      if (String(data.secret || "") !== SCRIPT_SECRET) {
        return jsonOut_({ ok: false, error: "Unauthorized" });
      }
    }

    var title = String(data.title || ("지티리포트_" + Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd")));
    var body = String(data.body || "");
    var folderId = String(data.folderId || FOLDER_ID_DEFAULT);

    if (!body) {
      return jsonOut_({ ok: false, error: "body is required" });
    }

    var folder = DriveApp.getFolderById(folderId);
    var doc = DocumentApp.create(title);
    var docFile = DriveApp.getFileById(doc.getId());
    folder.addFile(docFile);
    DriveApp.getRootFolder().removeFile(docFile);

    var docBody = doc.getBody();
    docBody.clear();
    var lines = body.split("\n");
    for (var i = 0; i < lines.length; i++) {
      docBody.appendParagraph(lines[i]);
    }
    doc.saveAndClose();

    var docId = doc.getId();
    var docUrl = "https://docs.google.com/document/d/" + docId + "/edit";

    return jsonOut_({
      ok: true,
      docId: docId,
      docUrl: docUrl,
      title: title,
      folderId: folderId,
    });
  } catch (err) {
    return jsonOut_({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

function doGet() {
  return jsonOut_({
    ok: true,
    service: "giti-report-docs",
    message: "POST JSON to create a report Doc",
  });
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
