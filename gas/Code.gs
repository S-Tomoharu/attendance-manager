// =============================================
// Code.gs - メインルーター
// =============================================

// GASウェブアプリのエントリーポイント（GET）
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getStudents':     return jsonResponse(getStudents(e.parameter));
      case 'getAttendance':   return jsonResponse(getAttendance(e.parameter));
      case 'getSettings':     return jsonResponse(getSettings(e.parameter));
      case 'getYears':        return jsonResponse(getYears());
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// GASウェブアプリのエントリーポイント（POST）
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  try {
    switch (action) {
      case 'setup':           return jsonResponse(setupYear(data));
      case 'saveStudents':    return jsonResponse(saveStudents(data));
      case 'saveAttendance':  return jsonResponse(saveAttendance(data));
      case 'saveSettings':    return jsonResponse(saveSettings(data));
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// JSONレスポンスを返すヘルパー
function jsonResponse(data, status) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// 現在選択中のスプレッドシートIDをスクリプトプロパティから取得
function getActiveSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ACTIVE_SPREADSHEET_ID');
  if (!id) throw new Error('スプレッドシートが設定されていません。セットアップを実行してください。');
  return SpreadsheetApp.openById(id);
}

// 利用可能な年度一覧を返す
function getYears() {
  const props = PropertiesService.getScriptProperties();
  const years = props.getProperty('YEARS');
  return { years: years ? JSON.parse(years) : [] };
}
