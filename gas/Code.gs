// =============================================
// Code.gs - メインルーター
// =============================================

// GASウェブアプリのエントリーポイント（GET）- HTMLを配信
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('授業欠課時数管理')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// GASウェブアプリのエントリーポイント（POST）- APIリクエスト処理
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  try {
    switch (action) {
      case 'getStudents':     return jsonResponse(getStudents(data));
      case 'getAttendance':   return jsonResponse(getAttendance(data));
      case 'getSettings':     return jsonResponse(getSettings(data));
      case 'getYears':        return jsonResponse(getYears());
      case 'setup':           return jsonResponse(setupYear(data));
      case 'saveStudents':    return jsonResponse(saveStudents(data));
      case 'saveAttendance':  return jsonResponse(saveAttendance(data));
      case 'saveSettings':    return jsonResponse(saveSettings(data));
      case 'switchYear':      return jsonResponse(switchYear(data));
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// JSONレスポンスを返すヘルパー
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

// クライアントサイドから呼び出し可能な関数群
function clientGetStudents(params)      { return getStudents(params); }
function clientGetAttendance(params)    { return getAttendance(params); }
function clientGetSettings(params)      { return getSettings(params); }
function clientGetYears()               { return getYears(); }
function clientSetupYear(data)          { return setupYear(data); }
function clientSaveStudents(data)       { return saveStudents(data); }
function clientSaveAttendance(data)     { return saveAttendance(data); }
function clientSaveSettings(data)       { return saveSettings(data); }
function clientSwitchYear(data)         { return switchYear(data); }
