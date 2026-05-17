// =============================================
// Attendance.gs - 出欠記録の読み書き
// =============================================

const STATUS = {
  PRESENT:  '出席',
  ABSENT:   '欠席',
  EXCUSED:  '公欠・出校停止',
  LEAVE:    '休学',
};

function getAttendance(params) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('attendance');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { records: [] };

  const { date, period, className } = params;

  const records = data.slice(1)
    .filter(row => {
      const rowDate = row[0] ? (row[0] instanceof Date 
        ? Utilities.formatDate(row[0], 'Asia/Tokyo', 'yyyy-MM-dd')
        : String(row[0]).slice(0, 10)) : '';
      return (!date || rowDate === date)
          && (!period || String(row[1]) === String(period))
          && (!className || row[2] === className);
    })
    .map(row => ({
      date:      row[0] instanceof Date 
        ? Utilities.formatDate(row[0], 'Asia/Tokyo', 'yyyy-MM-dd')
        : String(row[0]).slice(0, 10),
      period:    row[1],
      className: row[2],
      number:    row[3],
      name:      row[4],
      status:    row[5],
      timestamp: row[6] instanceof Date ? Utilities.formatDate(row[6], 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') : String(row[6]),
    }));

  return { records };
}

function saveAttendance(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('attendance');
  const { date, period, className, records } = data;

  // 既存の同日・同時限・同クラスのデータを削除
  const existing = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = existing.length - 1; i >= 1; i--) {
    const rowDate = existing[i][0]
      ? Utilities.formatDate(new Date(existing[i][0]), 'Asia/Tokyo', 'yyyy-MM-dd')
      : '';
    if (rowDate === date && String(existing[i][1]) === String(period) && existing[i][2] === className) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.forEach(row => sheet.deleteRow(row));

  // 出席以外のレコードのみ保存
  const nonPresent = records.filter(r => r.status !== STATUS.PRESENT);
  if (nonPresent.length > 0) {
    const timestamp = new Date();
    const rows = nonPresent.map(r => [date, period, className, r.number, r.name, r.status, timestamp]);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, 7).setValues(rows);
  }

  return { success: true, savedCount: nonPresent.length };
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

// 期間指定での出欠集計・CSV出力用データ取得
function getAttendanceSummary(params) {
  const ss = getActiveSpreadsheet();
  const { className, startDate, endDate } = params;

  // 生徒データ取得
  const studentsSheet = ss.getSheetByName('students');
  const studentsData = studentsSheet.getDataRange().getValues();
  const students = studentsData.slice(1)
    .filter(row => row[0] === className && row[1] !== '')
    .map(row => ({
      className:    row[0],
      number:       row[1],
      name:         row[2],
      leaveStart:   row[5] ? Utilities.formatDate(new Date(row[5]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
      leaveEnd:     row[6] ? Utilities.formatDate(new Date(row[6]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
    }));

  // 出欠データ取得
  const attendanceSheet = ss.getSheetByName('attendance');
  const attendanceData = attendanceSheet.getDataRange().getValues();
  const records = attendanceData.slice(1).filter(row => {
    const rowDate = row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd') : '';
    return row[2] === className && rowDate >= startDate && rowDate <= endDate;
  });

  // 期間内の授業コマ数（ユニークな日付+時限の組み合わせ）
  // attendance に記録がなくても授業があった日を数えるため
  // 「保存」した日付+時限をすべてカウント
  const allRecords = attendanceData.slice(1).filter(row => {
    const rowDate = row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd') : '';
    return row[2] === className && rowDate >= startDate && rowDate <= endDate;
  });

  // ユニークな授業コマを取得
  const lessonSet = new Set();
  allRecords.forEach(row => {
    const rowDate = Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd');
    lessonSet.add(`${rowDate}_${row[1]}`);
  });
  const totalLessons = lessonSet.size;

  // 生徒ごとに集計
  const summary = students.map(s => {
    // 休学期間チェック
    const isOnLeave = s.leaveStart && s.leaveEnd;

    if (isOnLeave) {
      return {
        number:        s.number,
        name:          s.name,
        lessonCount:   '',
        absenceCount:  '',
        onLeave:       true,
      };
    }

    // 公欠・出校停止のコマ数
    const excusedCount = records.filter(r =>
      String(r[3]) === String(s.number) && r[5] === STATUS.EXCUSED
    ).length;

    // 欠席のコマ数
    const absenceCount = records.filter(r =>
      String(r[3]) === String(s.number) && r[5] === STATUS.ABSENT
    ).length;

    return {
      number:       s.number,
      name:         s.name,
      lessonCount:  totalLessons - excusedCount,
      absenceCount: absenceCount,
      onLeave:      false,
    };
  });

  return { summary, totalLessons };
}

// クラスを追加
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

// クラスを削除
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
