// =============================================
// Students.gs - 生徒データの読み書き
// =============================================

function getStudents(params) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('students');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { students: [] };

  const classFilter = params ? params.className : null;

  const students = data.slice(1)
    .filter(row => row[0] !== '' && (!classFilter || row[0] === classFilter))
    .map(row => ({
      className:  row[0],
      number:     row[1],
      name:       row[2],
      seatRow:    row[3],
      seatCol:    row[4],
      leaveStart: row[5] ? Utilities.formatDate(new Date(row[5]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
      leaveEnd:   row[6] ? Utilities.formatDate(new Date(row[6]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
    }));

  return { students };
}

function saveStudents(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('students');
  const className = data.className;
  const students = data.students;

  // 既存の該当クラスのデータを削除
  const existing = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = existing.length - 1; i >= 1; i--) {
    if (existing[i][0] === className) rowsToDelete.push(i + 1);
  }
  rowsToDelete.forEach(row => sheet.deleteRow(row));

  if (students.length > 0) {
    const rows = students.map(s => [
      className,
      s.number,
      s.name,
      s.seatRow || '',
      s.seatCol || '',
      s.leaveStart || '',
      s.leaveEnd || '',
    ]);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, 7).setValues(rows);
  }

  return { success: true, count: students.length };
}

// 休学期間の設定
function saveLeaveperiod(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('students');
  const { className, number, leaveStart, leaveEnd } = data;

  const existing = sheet.getDataRange().getValues();
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][0] === className && String(existing[i][1]) === String(number)) {
      sheet.getRange(i + 1, 6).setValue(leaveStart || '');
      sheet.getRange(i + 1, 7).setValue(leaveEnd || '');
      return { success: true };
    }
  }
  return { error: '生徒が見つかりません' };
}
