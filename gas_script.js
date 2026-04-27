const SPREADSHEET_ID = '1Ahyt22lcq6C0BvFgX_9OgdGfCtagI_ZlGW0knEZd86s';
const MANAGER_PASSWORD = 'topMgr2024!';

const REPORT_HEADERS = [
  'name','date','visits','netMeet','mainMeet','negotiation','acquired',
  'startTime','endTime','acquiredCase','lostCase','goodPoints','issues',
  'improvements','learnings','gratitude','planDays',
  'area1','area2','area3','area4','area5','area6','area7','area8','area9','area10'
];

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function doGet(e) {
  const action = e.parameter.action;
  let result;
  if (action === 'getReports') {
    result = getReports(e.parameter.name);
  } else if (action === 'getShifts') {
    result = getShifts();
  } else if (action === 'getMembers') {
    result = getMembers();
  } else {
    result = { error: 'unknown action' };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  let result;
  if (action === 'getReports') {
    result = getReports(data.name);
  } else if (action === 'getShifts') {
    result = getShifts();
  } else if (action === 'saveReport') {
    result = saveReport(data);
  } else if (action === 'saveShift') {
    result = saveShift(data);
  } else if (action === 'saveMembers') {
    result = saveMembers(data.members);
  } else if (action === 'getAccount') {
    result = getAccount(data.name, data.password);
  } else if (action === 'updatePassword') {
    result = updatePassword(data.id, data.currentPassword, data.newPassword);
  } else {
    result = { error: 'unknown action' };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 日次報告 ───────────────────────────────────────────

function repairReportsSheet(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(REPORT_HEADERS);
    return;
  }
  const firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== 'name') {
    sheet.clearContents();
    sheet.appendRow(REPORT_HEADERS);
  }
}

function getReports(filterName) {
  const sheet = getSheet('reports');
  repairReportsSheet(sheet);
  if (sheet.getLastRow() <= 1) return { reports: [] };

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  if (!headers || headers[0] !== 'name') return { reports: [] };

  const reports = rows.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
      return obj;
    })
    .filter(r => r.name && (!filterName || r.name === filterName));
  return { reports };
}

function saveReport(data) {
  const sheet = getSheet('reports');
  repairReportsSheet(sheet);

  const allRows = sheet.getDataRange().getValues();
  const headers = allRows[0];
  const nameIdx = headers.indexOf('name');
  const dateIdx = headers.indexOf('date');
  const rowValues = headers.map(h => (data[h] !== undefined ? data[h] : ''));

  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][nameIdx] === data.name && allRows[i][dateIdx] === data.date) {
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowValues]);
      return { success: true };
    }
  }
  sheet.appendRow(rowValues);
  return { success: true };
}

// ── シフト ────────────────────────────────────────────

function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy-MM-dd');
  const s = String(val);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

function repairShiftsSheet(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['name', 'date', 'status']);
    return;
  }
  const firstRow = sheet.getRange(1, 1, 1, 3).getValues()[0];
  if (firstRow[0] !== 'name' || firstRow[1] !== 'date') {
    // ヘッダーがない → 既存データを退避してヘッダーを挿入
    const all = sheet.getDataRange().getValues();
    sheet.clearContents();
    sheet.appendRow(['name', 'date', 'status']);
    all.forEach(row => {
      sheet.appendRow([String(row[0]), toDateStr(row[1]), String(row[2])]);
    });
  }
}

function getShifts() {
  const sheet = getSheet('shifts');
  repairShiftsSheet(sheet);
  if (sheet.getLastRow() <= 1) return { shifts: [] };

  const rows = sheet.getDataRange().getValues();
  const shifts = rows.slice(1).map(row => ({
    name:   String(row[0]),
    date:   toDateStr(row[1]),
    status: String(row[2]),
  }));
  return { shifts };
}

function saveShift(data) {
  const sheet = getSheet('shifts');
  repairShiftsSheet(sheet);

  const allRows = sheet.getDataRange().getValues();
  for (let i = 1; i < allRows.length; i++) {
    if (String(allRows[i][0]) === data.name && toDateStr(allRows[i][1]) === data.date) {
      sheet.getRange(i + 1, 3).setValue(data.status);
      return { success: true };
    }
  }
  sheet.appendRow([data.name, data.date, data.status]);
  return { success: true };
}

// ── メンバー ──────────────────────────────────────────

function getMembers() {
  const sheet = getSheet('メンバー設定');
  if (sheet.getLastRow() <= 1) return { members: [] };

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const members = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    if (obj.target !== undefined) obj.target = Number(obj.target) || 0;
    if (obj.isManager !== undefined)
      obj.isManager = obj.isManager === true || obj.isManager === 'true' || obj.isManager === 'TRUE';
    delete obj.password;
    return obj;
  });
  return { members };
}

function saveMembers(members) {
  const sheet = getSheet('メンバー設定');

  const existingPasswords = {};
  if (sheet.getLastRow() > 1) {
    const rows    = sheet.getDataRange().getValues();
    const headers = rows[0];
    const idIdx   = headers.indexOf('id');
    const pwIdx   = headers.indexOf('password');
    if (pwIdx >= 0 && idIdx >= 0) {
      rows.slice(1).forEach(row => {
        if (row[idIdx]) existingPasswords[String(row[idIdx])] = row[pwIdx];
      });
    }
  }

  sheet.clearContents();
  sheet.appendRow(['id', 'name', 'role', 'target', 'isManager', 'password']);
  members.forEach(m => {
    const password = existingPasswords[m.id] || 'top2024';
    sheet.appendRow([m.id || '', m.name || '', m.role || 'closer', m.target || 0, m.isManager || false, password]);
  });
  return { success: true };
}

// ── 認証 ──────────────────────────────────────────────

function getAccount(name, password) {
  if (!name || !password) return { account: null };

  const isManagerPw = password === MANAGER_PASSWORD;
  const sheet = getSheet('メンバー設定');
  if (sheet.getLastRow() <= 1) return { account: null };

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const nameIdx = headers.indexOf('name');
  const pwIdx   = headers.indexOf('password');
  const idIdx   = headers.indexOf('id');
  const roleIdx = headers.indexOf('role');
  const mgIdx   = headers.indexOf('isManager');

  if (pwIdx < 0) {
    migrateAddPasswordColumn();
    return getAccount(name, password);
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][nameIdx]) !== name) continue;
    const memberPw = String(rows[i][pwIdx]);
    if (!isManagerPw && memberPw !== password) continue;

    const raw = rows[i][mgIdx];
    const memberIsManager = raw === true || raw === 'true' || raw === 'TRUE';
    return {
      account: {
        id:        String(rows[i][idIdx] || name),
        name:      String(rows[i][nameIdx]),
        role:      String(rows[i][roleIdx] || 'closer'),
        isManager: isManagerPw || memberIsManager,
      }
    };
  }
  return { account: null };
}

function updatePassword(id, currentPassword, newPassword) {
  if (!id || !currentPassword || !newPassword) return { success: false };

  const sheet = getSheet('メンバー設定');
  if (sheet.getLastRow() <= 1) return { success: false };

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('id');
  const pwIdx   = headers.indexOf('password');

  if (pwIdx < 0) return { success: false, error: 'パスワード列がありません' };

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) !== id) continue;
    if (String(rows[i][pwIdx]) !== currentPassword)
      return { success: false, error: '現在のパスワードが違います' };
    sheet.getRange(i + 1, pwIdx + 1).setValue(newPassword);
    return { success: true };
  }
  return { success: false, error: 'メンバーが見つかりません' };
}

function migrateAddPasswordColumn() {
  const sheet   = getSheet('メンバー設定');
  if (sheet.getLastRow() === 0) return;
  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  if (headers.indexOf('password') >= 0) return;
  const col = headers.length + 1;
  sheet.getRange(1, col).setValue('password');
  for (let i = 1; i < rows.length; i++) {
    sheet.getRange(i + 1, col).setValue('top2024');
  }
}

// ── スプレッドシート整形（手動で1回実行） ────────────────
// Apps Scriptエディタで formatSheets() を選択して ▶ 実行

function formatSheets() {
  formatReportsSheet();
  formatShiftsSheet();
  formatMembersSheet();
  SpreadsheetApp.getActive().toast('整形完了！', 'TOP Agency', 3);
}

function formatReportsSheet() {
  const sheet = getSheet('reports');
  if (sheet.getLastRow() === 0) return;

  // ── ヘッダーを日本語に変換 ──
  const headerMap = {
    name: '氏名', date: '日付', visits: '訪問数', netMeet: '対面数',
    mainMeet: '主権対面', negotiation: '商談', acquired: '獲得数',
    startTime: '開始時刻', endTime: '終了時刻',
    acquiredCase: '獲得案件', lostCase: '失注案件',
    goodPoints: 'よかった点', issues: '課題・失敗',
    improvements: '改善ポイント', learnings: '学び・気づき',
    gratitude: '感謝', planDays: '計画稼働日数',
    area1: 'エリア①', area2: 'エリア②', area3: 'エリア③',
    area4: 'エリア④', area5: 'エリア⑤', area6: 'エリア⑥',
    area7: 'エリア⑦', area8: 'エリア⑧', area9: 'エリア⑨',
    area10: 'エリア⑩',
  };
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newHeaders = currentHeaders.map(h => headerMap[h] || h);
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);

  // ── ヘッダー行のスタイル ──
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground('#1e293b').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  // ── 列幅 ──
  sheet.setColumnWidth(1, 80);   // 氏名
  sheet.setColumnWidth(2, 100);  // 日付
  for (let c = 3; c <= 9; c++) sheet.setColumnWidth(c, 65);   // 数値
  sheet.setColumnWidth(10, 65);  // 開始
  sheet.setColumnWidth(11, 65);  // 終了
  for (let c = 12; c <= 18; c++) sheet.setColumnWidth(c, 200); // テキスト
  for (let c = 19; c <= 28; c++) sheet.setColumnWidth(c, 80);  // エリア

  // ── 行の高さを数値列は低く、テキスト列は折り返し ──
  sheet.setRowHeightsForced(1, 1, 30);
  if (sheet.getLastRow() > 1) {
    const textCols = [10, 11, 12, 13, 14, 15, 16, 17, 18];
    textCols.forEach(c => {
      if (c <= sheet.getLastColumn()) {
        sheet.getRange(2, c, sheet.getLastRow() - 1, 1)
          .setWrap(true);
      }
    });
  }

  // ── 数値列を中央揃え ──
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 3, sheet.getLastRow() - 1, 7)
      .setHorizontalAlignment('center');
  }

  // ── 1行目を固定・フィルタON ──
  sheet.setFrozenRows(1);
  if (sheet.getLastRow() > 1) {
    try { sheet.getFilter()?.remove(); } catch(e) {}
    sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).createFilter();
  }

  // ── 交互の背景色（ゼブラ） ──
  if (sheet.getLastRow() > 1) {
    for (let r = 2; r <= sheet.getLastRow(); r++) {
      const bg = r % 2 === 0 ? '#f8fafc' : '#ffffff';
      sheet.getRange(r, 1, 1, sheet.getLastColumn()).setBackground(bg);
    }
  }
}

function formatShiftsSheet() {
  const sheet = getSheet('shifts');
  if (sheet.getLastRow() === 0) return;

  // ヘッダー日本語化
  const headerRange = sheet.getRange(1, 1, 1, 3);
  headerRange.setValues([['氏名', '日付', 'シフト']]);
  headerRange.setBackground('#0f766e').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 80);

  // シフト列に条件付き書式（稼働=緑、休日=灰）
  if (sheet.getLastRow() > 1) {
    const dataRange = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1);
    const rules = SpreadsheetApp.newConditionalFormatRule();
    const workRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('稼働')
      .setBackground('#bbf7d0').setFontColor('#166534')
      .setRanges([dataRange]).build();
    const offRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('休日')
      .setBackground('#e5e7eb').setFontColor('#6b7280')
      .setRanges([dataRange]).build();
    sheet.setConditionalFormatRules([workRule, offRule]);

    // 全体を中央揃え
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).setHorizontalAlignment('center');
    // ゼブラ
    for (let r = 2; r <= sheet.getLastRow(); r++) {
      sheet.getRange(r, 1, 1, 3).setBackground(r % 2 === 0 ? '#f0fdf4' : '#ffffff');
    }
  }

  sheet.setFrozenRows(1);
  if (sheet.getLastRow() > 1) {
    try { sheet.getFilter()?.remove(); } catch(e) {}
    sheet.getRange(1, 1, sheet.getLastRow(), 3).createFilter();
  }
}

function formatMembersSheet() {
  const sheet = getSheet('メンバー設定');
  if (sheet.getLastRow() === 0) return;

  const numCols = sheet.getLastColumn();
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  const headerMap = {
    id: 'ID', name: '氏名', role: '役割', target: '月間目標',
    isManager: '責任者', password: 'パスワード',
  };
  const currentH = headerRange.getValues()[0];
  headerRange.setValues([currentH.map(h => headerMap[h] || h)]);
  headerRange.setBackground('#7c3aed').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.setColumnWidth(1, 160); // ID
  sheet.setColumnWidth(2, 80);  // 氏名
  sheet.setColumnWidth(3, 100); // 役割
  sheet.setColumnWidth(4, 90);  // 目標
  sheet.setColumnWidth(5, 80);  // 責任者
  if (numCols >= 6) sheet.setColumnWidth(6, 120); // パスワード

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols)
      .setHorizontalAlignment('center');
  }

  sheet.setFrozenRows(1);
}
