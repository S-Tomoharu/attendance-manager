// =============================================
// Setup.gs - 年度セットアップ・スプレッドシート自動作成
// =============================================

function setupYear(data) {
  const year = data.year;
  const folderName = data.folderName || '出欠管理';

  let folder;
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  const ssName = year + '年度_出欠管理';
  const ss = SpreadsheetApp.create(ssName);

  const file = DriveApp.getFileById(ss.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  initializeSheets(ss);

  const props = PropertiesService.getScriptProperties();
  props.setProperty('ACTIVE_SPREADSHEET_ID', ss.getId());

  const yearsJson = props.getProperty('YEARS');
  const years = yearsJson ? JSON.parse(yearsJson) : [];
  if (!years.find(y => y.year === year)) {
    years.unshift({ year: year, spreadsheetId: ss.getId(), name: ssName });
    props.setProperty('YEARS', JSON.stringify(years));
  }

  return {
    success: true,
    year: year,
    spreadsheetId: ss.getId(),
    spreadsheetName: ssName,
    spreadsheetUrl: ss.getUrl()
  };
}

function switchYear(data) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ACTIVE_SPREADSHEET_ID', data.spreadsheetId);
  return { success: true };
}

function initializeSheets(ss) {
  const defaultSheet = ss.getSheets()[0];
  defaultSheet.setName('students');
  setupStudentsSheet(defaultSheet);

  const attendanceSheet = ss.insertSheet('attendance');
  setupAttendanceSheet(attendanceSheet);

  const settingsSheet = ss.insertSheet('settings');
  setupSettingsSheet(settingsSheet);
}

function setupStudentsSheet(sheet) {
  const headers = ['クラス', '出席番号', '名前', '座席行', '座席列', '休学開始日', '休学終了日'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupAttendanceSheet(sheet) {
  const headers = ['日付', '時限', 'クラス', '出席番号', '名前', '状態', 'タイムスタンプ'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupSettingsSheet(sheet) {
  const headers = ['クラス', '行数', '列数'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, 2, 3).setValues([
    ['クラスA', 7, 7],
    ['クラスB', 6, 7],
  ]);
}
