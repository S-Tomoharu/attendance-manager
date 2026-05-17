// =============================================
// Code.gs - メインルーター
// =============================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('授業欠課時数管理')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  try {
    switch (action) {
      case 'getStudents':          return jsonResponse(getStudents(data));
      case 'getAttendance':        return jsonResponse(getAttendance(data));
      case 'getSettings':          return jsonResponse(getSettings(data));
      case 'getYears':             return jsonResponse(getYears());
      case 'getAttendanceSummary': return jsonResponse(getAttendanceSummary(data));
      case 'setup':                return jsonResponse(setupYear(data));
      case 'saveStudents':         return jsonResponse(saveStudents(data));
      case 'saveAttendance':       return jsonResponse(saveAttendance(data));
      case 'saveSettings':         return jsonResponse(saveSettings(data));
      case 'switchYear':           return jsonResponse(switchYear(data));
      case 'saveLeaveperiod':      return jsonResponse(saveLeaveperiod(data));
      case 'addClass':             return jsonResponse(addClass(data));
      case 'deleteClass':          return jsonResponse(deleteClass(data));
      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getActiveSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ACTIVE_SPREADSHEET_ID');
  if (!id) throw new Error('スプレッドシートが設定されていません。');
  return SpreadsheetApp.openById(id);
}

function getYears() {
  const props = PropertiesService.getScriptProperties();
  const years = props.getProperty('YEARS');
  return { years: years ? JSON.parse(years) : [] };
}

// paramsをJSON文字列として受け取りパースする
function p(params) {
  if (typeof params === 'string') return JSON.parse(params);
  return params || {};
}

function clientGetStudents(params)           { return getStudents(p(params)); }
function clientGetAttendance(params)         { return getAttendance(p(params)) || { records: [] }; }
function clientGetSettings(params)           { return getSettings(p(params)); }
function clientGetYears()                    { return getYears(); }
function clientGetAttendanceSummary(params)  { return getAttendanceSummary(p(params)); }
function clientSetupYear(data)               { return setupYear(p(data)); }
function clientSaveStudents(data)            { return saveStudents(p(data)); }
function clientSaveAttendance(data)          { return saveAttendance(p(data)); }
function clientSaveSettings(data)            { return saveSettings(p(data)); }
function clientSwitchYear(data)              { return switchYear(p(data)); }
function clientSaveLeaveperiod(data)         { return saveLeaveperiod(p(data)); }
function clientAddClass(data)                { return addClass(p(data)); }
function clientDeleteClass(data)             { return deleteClass(p(data)); }

function clientGetAttendanceMatrix(params)  { return getAttendanceMatrix(p(params)) || { records: [] }; }
function clientUpdateAttendanceCell(data)   { return updateAttendanceCell(p(data)); }
