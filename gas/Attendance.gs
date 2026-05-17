// =============================================
// Attendance.gs - 出欠記録の読み書き
// =============================================

const STATUS = {
  PRESENT:  '出席',
  ABSENT:   '欠席',
  EXCUSED:  '公欠・出校停止',
  LEAVE:    '休学',
};

// クラス名からシート名を生成
function attendanceSheetName(className) {
  return 'attendance_' + className;
}

// クラスの出欠シートを取得（なければ作成）
function getOrCreateAttendanceSheet(ss, className) {
  const name = attendanceSheetName(className);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // 1行目: ヘッダー（A1=番号, B1=名前, 以降は授業コマ）
    sheet.getRange(1, 1).setValue('番号');
    sheet.getRange(1, 2).setValue('名前');
    sheet.getRange(1, 1, 1, 2)
      .setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(2);

    // 生徒データを初期化
    const studentsSheet = ss.getSheetByName('students');
    if (studentsSheet) {
      const data = studentsSheet.getDataRange().getValues();
      const students = data.slice(1)
        .filter(row => row[0] === className && row[1] !== '')
        .sort((a, b) => Number(a[1]) - Number(b[1]));
      if (students.length > 0) {
        const rows = students.map(s => [s[1], s[2]]);
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      }
    }
  }
  return sheet;
}

// 授業コマのカラムキー
function lessonKey(date, period) {
  return date + '_' + period;
}

// カラムキーからヘッダー表示用テキスト
function lessonHeader(date, period) {
  return date + '\n' + period + '限';
}

// シートのヘッダー行からコマ→列番号のマップを取得
function getLessonColMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => {
    if (i >= 2) map[h] = i + 1; // 1-indexed
  });
  return map;
}

// 生徒番号→行番号のマップを取得
function getStudentRowMap(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const numbers = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const map = {};
  numbers.forEach((row, i) => {
    if (row[0] !== '') map[String(row[0])] = i + 2; // 1-indexed
  });
  return map;
}

// 出欠保存（全員分）
function saveAttendance(data) {
  const ss = getActiveSpreadsheet();
  const { date, period, className, records } = data;
  const sheet = getOrCreateAttendanceSheet(ss, className);

  const key = lessonKey(date, period);
  let colMap = getLessonColMap(sheet);

  // コマ列がなければ追加
  if (!colMap[key]) {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue(key);
    sheet.getRange(1, newCol)
      .setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold')
      .setWrap(true);
    sheet.setColumnWidth(newCol, 70);
    colMap[key] = newCol;
  }

  const col = colMap[key];
  const rowMap = getStudentRowMap(sheet);

  // 全員分の出欠を書き込む
  records.forEach(r => {
    const row = rowMap[String(r.number)];
    if (row) {
      sheet.getRange(row, col).setValue(r.status);
    }
  });

  return { success: true, savedCount: records.length };
}

// 出欠読み込み（座席マップ用：特定日・時限）
function getAttendance(params) {
  const ss = getActiveSpreadsheet();
  const { date, period, className } = params;
  const sheetName = attendanceSheetName(className);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { records: [] };

  const key = lessonKey(date, period);
  const colMap = getLessonColMap(sheet);
  const col = colMap[key];
  if (!col) return { records: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { records: [] };

  const data = sheet.getRange(2, 1, lastRow - 1, col).getValues();
  const records = data
    .filter(row => row[0] !== '')
    .map(row => ({
      date,
      period,
      className,
      number: String(row[0]),
      name:   row[1],
      status: row[col - 1] || STATUS.PRESENT,
    }));

  return { records };
}

// 履歴マトリクス用：期間内の全出欠データ取得
function getAttendanceMatrix(params) {
  const ss = getActiveSpreadsheet();
  const { className, startDate, endDate } = params;
  const sheetName = attendanceSheetName(className);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { lessons: [], students: [], matrix: {} };

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastCol < 3 || lastRow < 2) return { lessons: [], students: [], matrix: {} };

  // ヘッダーからコマ一覧を取得
  const headers = sheet.getRange(1, 3, 1, lastCol - 2).getValues()[0];
  const lessons = headers
    .map((h, i) => ({ key: h, col: i + 3 }))
    .filter(l => {
      const d = l.key.split('_')[0];
      return d >= startDate && d <= endDate;
    });

  // 生徒データ取得
  const studentData = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const students = studentData.filter(r => r[0] !== '').map(r => ({
    number: String(r[0]),
    name:   r[1],
  }));

  // 出欠データ取得
  const matrix = {};
  if (lessons.length > 0) {
    const cols = lessons.map(l => l.col);
    students.forEach((s, si) => {
      matrix[s.number] = {};
      lessons.forEach((l, li) => {
        const val = sheet.getRange(si + 2, l.col).getValue();
        matrix[s.number][l.key] = val || STATUS.PRESENT;
      });
    });
  }

  return { lessons: lessons.map(l => l.key), students, matrix };
}

// 単一セルの出欠を更新
function updateAttendanceCell(data) {
  const ss = getActiveSpreadsheet();
  const { date, period, className, number, status } = data;
  const sheet = ss.getSheetByName(attendanceSheetName(className));
  if (!sheet) return { error: 'シートが見つかりません' };

  const key = lessonKey(date, period);
  const colMap = getLessonColMap(sheet);
  const col = colMap[key];
  if (!col) return { error: 'コマが見つかりません' };

  const rowMap = getStudentRowMap(sheet);
  const row = rowMap[String(number)];
  if (!row) return { error: '生徒が見つかりません' };

  sheet.getRange(row, col).setValue(status);
  return { success: true };
}

function getSettings(params) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('settings');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { settings: [] };

  const settings = data.slice(1)
    .filter(row => row[0] !== '')
    .map(row => ({
      className: row[0],
      rows:      Number(row[1]),
      cols:      Number(row[2]),
    }));

  return { settings };
}

function saveSettings(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('settings');
  const { settings } = data;

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);

  if (settings.length > 0) {
    const rows = settings.map(s => [s.className, s.rows, s.cols]);
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }

  return { success: true };
}

// 期間集計（CSV出力用）
function getAttendanceSummary(params) {
  const ss = getActiveSpreadsheet();
  const { className, startDate, endDate } = params;

  const matrixData = getAttendanceMatrix({ className, startDate, endDate });
  const { lessons, students, matrix } = matrixData;

  const studentsSheet = ss.getSheetByName('students');
  const studentsData = studentsSheet.getDataRange().getValues();
  const leaveMap = {};
  studentsData.slice(1).filter(row => row[0] === className).forEach(row => {
    leaveMap[String(row[1])] = {
      leaveStart: row[5] ? Utilities.formatDate(new Date(row[5]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
      leaveEnd:   row[6] ? Utilities.formatDate(new Date(row[6]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
    };
  });

  const summary = students.map(s => {
    const leave = leaveMap[s.number] || {};
    const isOnLeave = leave.leaveStart && leave.leaveEnd;
    if (isOnLeave) return { number: s.number, name: s.name, lessonCount: '', absenceCount: '', onLeave: true };

    let lessonCount = 0;
    let absenceCount = 0;
    lessons.forEach(key => {
      const status = (matrix[s.number] || {})[key] || STATUS.PRESENT;
      if (status !== STATUS.EXCUSED) lessonCount++;
      if (status === STATUS.ABSENT) absenceCount++;
    });

    return { number: s.number, name: s.name, lessonCount, absenceCount, onLeave: false };
  });

  return { summary, totalLessons: lessons.length };
}

// クラス追加・削除
function addClass(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('settings');
  const existing = sheet.getDataRange().getValues();
  const exists = existing.slice(1).some(row => row[0] === data.className);
  if (exists) return { error: 'そのクラス名はすでに存在します' };
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, 3).setValues([[data.className, 6, 7]]);
  return { success: true };
}

function deleteClass(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('settings');
  const existing = sheet.getDataRange().getValues();
  for (let i = existing.length - 1; i >= 1; i--) {
    if (existing[i][0] === data.className) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'クラスが見つかりません' };
}
