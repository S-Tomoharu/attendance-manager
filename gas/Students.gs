// =============================================
// Students.gs - 生徒データの読み書き
// =============================================

function getStudents(params) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('students');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { students: [] };

  const headers = data[0];
  const classFilter = params.className;

  const students = data.slice(1)
    .filter(row => row[0] !== '' && (!classFilter || row[0] === classFilter))
    .map(row => ({
      className:   row[0],
      number:      row[1],
      name:        row[2],
      seatRow:     row[3],
      seatCol:     row[4],
    }));

  return { students };
}

function saveStudents(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('students');
  const className = data.className;
  const students = data.students; // [{number, name, seatRow, seatCol}, ...]

  // 既存の該当クラスのデータを削除
  const existing = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = existing.length - 1; i >= 1; i--) {
    if (existing[i][0] === className) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.forEach(row => sheet.deleteRow(row));

  // 新しいデータを追記
  if (students.length > 0) {
    const rows = students.map(s => [
      className,
      s.number,
      s.name,
      s.seatRow || '',
      s.seatCol || '',
    ]);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, 5).setValues(rows);
  }

  return { success: true, count: students.length };
}
