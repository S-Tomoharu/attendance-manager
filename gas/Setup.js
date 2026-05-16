// =============================================
// Setup.gs - 年度セットアップ・スプレッドシート自動作成
// =============================================

function setupYear(data) {
  const year = data.year; // 例: "2026"
  const folderName = data.folderName || '出欠管理';

  // Driveのルートまたは指定フォルダに保存
  let folder;
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  // スプレッドシートを作成
  const ssName = year + '年度_出欠管理';
  const ss = SpreadsheetApp.create(ssName);

  // 作成したファイルをフォルダに移動
  const file = DriveApp.getFileById(ss.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // シートを初期化
  initializeSheets(ss);

  // スクリプトプロパティに保存
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ACTIVE_SPREADSHEET_ID', ss.getId());

  // 年度一覧を更新
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

// 既存の年度に切り替える
function switchYear(data) {
  const spreadsheetId = data.spreadsheetId;
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ACTIVE_SPREADSHEET_ID', spreadsheetId);
  return { success: true };
}

// シートの初期構造を作成
function initializeSheets(ss) {
  // デフォルトシートをstudentsにリネーム
  const defaultSheet = ss.getSheets()[0];
  defaultSheet.setName('students');
  setupStudentsSheet(defaultSheet);

  // attendanceシートを作成
  const attendanceSheet = ss.insertSheet('attendance');
  setupAttendanceSheet(attendanceSheet);

  // settingsシートを作成
  const settingsSheet = ss.insertSheet('settings');
  setupSettingsSheet(settingsSheet);
}

function setupStudentsSheet(sheet) {
  const headers = ['クラス', '出席番号', '名前', '座席行', '座席列'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90D9')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupAttendanceSheet(sheet) {
  const headers = ['日付', '時限', 'クラス', '出席番号', '名前', '状態', 'タイムスタンプ'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90D9')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupSettingsSheet(sheet) {
  const headers = ['クラス', '行数', '列数', '空席リスト'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90D9')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);

  // デフォルト設定を追加
  sheet.getRange(2, 1, 2, 4).setValues([
    ['クラスA', 7, 7, ''],
    ['クラスB', 6, 7, ''],
  ]);
}
