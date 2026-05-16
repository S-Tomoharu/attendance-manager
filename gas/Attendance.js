// =============================================
// Attendance.gs - 出欠記録の読み書き
// =============================================

// 出欠状態の定数
const STATUS = {
  PRESENT:  '出席',
  ABSENT:   '欠席',
  LATE:     '遅刻/早退',
  EXCUSED:  '公欠',
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
      const rowDate = row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd') : '';
      return (!date || rowDate === date)
          && (!period || String(row[1]) === String(period))
          && (!className || row[2] === className);
    })
    .map(row => ({
      date:      Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd'),
      period:    row[1],
      className: row[2],
      number:    row[3],
      name:      row[4],
      status:    row[5],
      timestamp: row[6],
    }));

  return { records };
}

function saveAttendance(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('attendance');
  const { date, period, className, records } = data;
  // records: [{number, name, status}, ...] ※出席以外のみ送る

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
      className:  row[0],
      rows:       Number(row[1]),
      cols:       Number(row[2]),
      emptySeats: row[3] ? String(row[3]).split(',').map(s => s.trim()) : [],
    }));

  return { settings };
}

function saveSettings(data) {
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName('settings');
  const { settings } = data; // [{className, rows, cols, emptySeats}, ...]

  // settingsシートを再構築
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);

  if (settings.length > 0) {
    const rows = settings.map(s => [
      s.className,
      s.rows,
      s.cols,
      s.emptySeats ? s.emptySeats.join(',') : '',
    ]);
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }

  return { success: true };
}
