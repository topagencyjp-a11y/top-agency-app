const SPREADSHEET_ID = '1Ahyt22lcq6C0BvFgX_9OgdGfCtagI_ZlGW0knEZd86s';
const MANAGER_PASSWORD = 'topMgr2024!';

const REPORT_HEADERS = [
  'name','date','visits','netMeet','mainMeet','negotiation','acquired',
  'startTime','endTime','acquiredCase','lostCase','goodPoints','issues',
  'improvements','learnings','gratitude','planDays',
  'area1','area2','area3','area4','area5','area6','area7','area8','area9','area10',
  'updatedAt','updatedBy'
];

const SHIFT_HEADERS = ['name', 'date', 'status', 'updatedAt', 'updatedBy'];

const MEMBER_HEADERS = ['id', 'name', 'role', 'target', 'isManager', 'password', 'planDays'];

const SUMMARY_HEADERS = [
  'month', 'name', 'totalVisits', 'totalNetMeet', 'totalMainMeet',
  'totalNegotiation', 'totalAcquired', 'workedDays', 'productivity',
  'forecast', 'meetRate', 'getRate', 'updatedAt'
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
    result = getReports({ name: e.parameter.name, month: e.parameter.month, week: e.parameter.week });
  } else if (action === 'getShifts') {
    result = getShifts();
  } else if (action === 'getMembers') {
    result = getMembers();
  } else if (action === 'getMonthlySummary') {
    result = getMonthlySummary(e.parameter.month);
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
    result = getReports({ name: data.name, month: data.month, week: data.week });
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
  } else if (action === 'adminUpdateReport') {
    result = adminUpdateReport(data, data.adminName);
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
  const numCols = sheet.getLastColumn();
  const firstRow = sheet.getRange(1, 1, 1, numCols).getValues()[0].map(String);
  if (firstRow[0] !== 'name') {
    sheet.clearContents();
    sheet.appendRow(REPORT_HEADERS);
    return;
  }
  // 既存シートに不足カラムがあれば末尾に追加（マイグレーション）
  REPORT_HEADERS.forEach(h => {
    if (!firstRow.includes(h)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
    }
  });
}

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function getReports(params) {
  if (typeof params === 'string') params = { name: params };
  params = params || {};

  const sheet = getSheet('reports');
  repairReportsSheet(sheet);
  if (sheet.getLastRow() <= 1) return { reports: [] };

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  if (!headers || headers[0] !== 'name') return { reports: [] };

  const reports = rows.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
      return obj;
    })
    .filter(r => {
      if (!r.name) return false;
      if (params.name && r.name !== params.name) return false;
      const dateStr = String(r.date).slice(0, 10);
      if (params.month && !dateStr.startsWith(params.month)) return false;
      if (params.week && getISOWeek(dateStr) !== params.week) return false;
      return true;
    });

  return { reports };
}

function saveReport(data) {
  const sheet = getSheet('reports');
  repairReportsSheet(sheet);

  const allRows = sheet.getDataRange().getValues();
  const headers = allRows[0];
  const nameIdx = headers.indexOf('name');
  const dateIdx = headers.indexOf('date');

  const updatedAt = new Date();
  const updatedBy = data.updatedBy || data.name;

  const rowValues = headers.map(h => {
    if (h === 'updatedAt') return updatedAt;
    if (h === 'updatedBy') return updatedBy;
    return data[h] !== undefined ? data[h] : '';
  });

  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][nameIdx] === data.name && allRows[i][dateIdx] === data.date) {
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowValues]);
      updateMonthlySummary(data.name, data.date);
      return { success: true };
    }
  }
  sheet.appendRow(rowValues);
  updateMonthlySummary(data.name, data.date);
  return { success: true };
}

function adminUpdateReport(data, adminName) {
  const memberSheet = getSheet('メンバー設定');
  if (memberSheet.getLastRow() <= 1) return { success: false, error: '権限確認失敗' };

  const rows = memberSheet.getDataRange().getValues();
  const headers = rows[0];
  const nameIdx = headers.indexOf('name');
  const mgIdx   = headers.indexOf('isManager');

  let isAdmin = false;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][nameIdx]) === adminName) {
      const raw = rows[i][mgIdx];
      isAdmin = raw === true || raw === 'true' || raw === 'TRUE';
      break;
    }
  }

  if (!isAdmin) return { success: false, error: '管理者権限がありません' };
  return saveReport({ ...data, updatedBy: adminName });
}

// ── 月次サマリー ─────────────────────────────────────

function repairMonthlySummarySheet(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SUMMARY_HEADERS);
    return;
  }
  const firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== 'month') {
    sheet.clearContents();
    sheet.appendRow(SUMMARY_HEADERS);
  }
}

function updateMonthlySummary(name, date) {
  const month = String(date).slice(0, 7);

  const reportsSheet = getSheet('reports');
  if (reportsSheet.getLastRow() <= 1) return;

  const rows    = reportsSheet.getDataRange().getValues();
  const headers = rows[0];
  const nameIdx        = headers.indexOf('name');
  const dateIdx        = headers.indexOf('date');
  const visitsIdx      = headers.indexOf('visits');
  const netMeetIdx     = headers.indexOf('netMeet');
  const mainMeetIdx    = headers.indexOf('mainMeet');
  const negotiationIdx = headers.indexOf('negotiation');
  const acquiredIdx    = headers.indexOf('acquired');
  const planDaysIdx    = headers.indexOf('planDays');

  let totalVisits = 0, totalNetMeet = 0, totalMainMeet = 0;
  let totalNegotiation = 0, totalAcquired = 0;
  let workedDays = 0, latestPlanDays = 0;

  rows.slice(1).forEach(row => {
    if (String(row[nameIdx]) !== name) return;
    const rowDate = String(row[dateIdx]).slice(0, 10);
    if (!rowDate.startsWith(month)) return;
    totalVisits      += Number(row[visitsIdx])      || 0;
    totalNetMeet     += Number(row[netMeetIdx])     || 0;
    totalMainMeet    += Number(row[mainMeetIdx])    || 0;
    totalNegotiation += Number(row[negotiationIdx]) || 0;
    totalAcquired    += Number(row[acquiredIdx])    || 0;
    workedDays++;
    if (planDaysIdx >= 0) latestPlanDays = Number(row[planDaysIdx]) || latestPlanDays;
  });

  const productivity = workedDays > 0 ? totalAcquired / workedDays : 0;
  const forecast     = latestPlanDays > 0 ? productivity * latestPlanDays : totalAcquired;
  const meetRate     = totalVisits > 0 ? totalNetMeet / totalVisits : 0;
  const getRate      = totalNetMeet > 0 ? totalAcquired / totalNetMeet : 0;

  const summarySheet = getSheet('月次サマリー');
  repairMonthlySummarySheet(summarySheet);

  const newRow = [
    month, name, totalVisits, totalNetMeet, totalMainMeet,
    totalNegotiation, totalAcquired, workedDays, productivity,
    forecast, meetRate, getRate, new Date()
  ];

  if (summarySheet.getLastRow() <= 1) {
    summarySheet.appendRow(newRow);
    return;
  }

  const summaryRows = summarySheet.getDataRange().getValues();
  const sumHeaders  = summaryRows[0];
  const mIdx        = sumHeaders.indexOf('month');
  const nIdx        = sumHeaders.indexOf('name');

  for (let i = 1; i < summaryRows.length; i++) {
    if (String(summaryRows[i][mIdx]) === month && String(summaryRows[i][nIdx]) === name) {
      summarySheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return;
    }
  }
  summarySheet.appendRow(newRow);
}

function getMonthlySummary(month) {
  const sheet = getSheet('月次サマリー');
  repairMonthlySummarySheet(sheet);
  if (sheet.getLastRow() <= 1) return { summary: [] };

  const rows     = sheet.getDataRange().getValues();
  const headers  = rows[0];
  const monthIdx = headers.indexOf('month');

  const summary = rows.slice(1)
    .filter(row => !month || String(row[monthIdx]) === month)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
      return obj;
    });

  return { summary };
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
    sheet.appendRow(SHIFT_HEADERS);
    return;
  }
  const numCols = sheet.getLastColumn();
  const firstRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  if (firstRow[0] !== 'name' || firstRow[1] !== 'date') {
    const all = sheet.getDataRange().getValues();
    sheet.clearContents();
    sheet.appendRow(SHIFT_HEADERS);
    all.forEach(row => {
      sheet.appendRow([String(row[0]), toDateStr(row[1]), String(row[2]), '', '']);
    });
  } else {
    // マイグレーション: 不足カラムを追加
    if (numCols < 4) sheet.getRange(1, 4).setValue('updatedAt');
    if (numCols < 5) sheet.getRange(1, 5).setValue('updatedBy');
  }
}

function getShifts() {
  const sheet = getSheet('shifts');
  repairShiftsSheet(sheet);
  if (sheet.getLastRow() <= 1) return { shifts: [] };

  const rows      = sheet.getDataRange().getValues();
  const headers   = rows[0];
  const nameIdx   = headers.indexOf('name');
  const dateIdx   = headers.indexOf('date');
  const statusIdx = headers.indexOf('status');

  const shifts = rows.slice(1).map(row => ({
    name:   String(row[nameIdx]),
    date:   toDateStr(row[dateIdx]),
    status: String(row[statusIdx]),
  }));
  return { shifts };
}

function saveShift(data) {
  const sheet = getSheet('shifts');
  repairShiftsSheet(sheet);

  const now       = new Date();
  const updatedBy = data.updatedBy || data.name;

  const allRows      = sheet.getDataRange().getValues();
  const headers      = allRows[0];
  const nameIdx      = headers.indexOf('name');
  const dateIdx      = headers.indexOf('date');
  const statusIdx    = headers.indexOf('status');
  const updatedAtIdx = headers.indexOf('updatedAt');
  const updatedByIdx = headers.indexOf('updatedBy');

  for (let i = 1; i < allRows.length; i++) {
    if (String(allRows[i][nameIdx]) === data.name && toDateStr(allRows[i][dateIdx]) === data.date) {
      if (statusIdx    >= 0) sheet.getRange(i + 1, statusIdx    + 1).setValue(data.status);
      if (updatedAtIdx >= 0) sheet.getRange(i + 1, updatedAtIdx + 1).setValue(now);
      if (updatedByIdx >= 0) sheet.getRange(i + 1, updatedByIdx + 1).setValue(updatedBy);
      return { success: true };
    }
  }
  sheet.appendRow([data.name, data.date, data.status, now, updatedBy]);
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
    if (obj.target   !== undefined) obj.target   = Number(obj.target)   || 0;
    if (obj.planDays !== undefined) obj.planDays = Number(obj.planDays) || 0;
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
  sheet.appendRow(MEMBER_HEADERS);
  members.forEach(m => {
    const password = existingPasswords[m.id] || 'top2024';
    sheet.appendRow([
      m.id || '', m.name || '', m.role || 'closer', m.target || 0,
      m.isManager || false, password, m.planDays || 0
    ]);
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
  formatMonthlySummarySheet();
  SpreadsheetApp.getActive().toast('整形完了！', 'TOP Agency', 3);
}

function formatReportsSheet() {
  const sheet = getSheet('reports');
  if (sheet.getLastRow() === 0) return;

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
    area10: 'エリア⑩', updatedAt: '更新日時', updatedBy: '更新者',
  };
  const numCols = sheet.getLastColumn();
  const currentHeaders = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  sheet.getRange(1, 1, 1, numCols).setValues([currentHeaders.map(h => headerMap[h] || h)]);

  sheet.getRange(1, 1, 1, numCols)
    .setBackground('#1e293b').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 100);
  for (let c = 3; c <= 11; c++) sheet.setColumnWidth(c, 65);
  for (let c = 12; c <= 17; c++) sheet.setColumnWidth(c, 200);
  for (let c = 18; c <= 27; c++) sheet.setColumnWidth(c, 80);
  if (numCols >= 28) sheet.setColumnWidth(28, 140);
  if (numCols >= 29) sheet.setColumnWidth(29, 80);

  sheet.setRowHeightsForced(1, 1, 30);
  if (sheet.getLastRow() > 1) {
    [10, 11, 12, 13, 14, 15, 16, 17].forEach(c => {
      if (c <= numCols) sheet.getRange(2, c, sheet.getLastRow() - 1, 1).setWrap(true);
    });
    sheet.getRange(2, 3, sheet.getLastRow() - 1, 7).setHorizontalAlignment('center');
    for (let r = 2; r <= sheet.getLastRow(); r++) {
      sheet.getRange(r, 1, 1, numCols).setBackground(r % 2 === 0 ? '#f8fafc' : '#ffffff');
    }
  }

  sheet.setFrozenRows(1);
  if (sheet.getLastRow() > 1) {
    try { sheet.getFilter()?.remove(); } catch(e) {}
    sheet.getRange(1, 1, sheet.getLastRow(), numCols).createFilter();
  }
}

function formatShiftsSheet() {
  const sheet = getSheet('shifts');
  if (sheet.getLastRow() === 0) return;

  const headerMap = {
    name: '氏名', date: '日付', status: 'シフト',
    updatedAt: '更新日時', updatedBy: '更新者',
  };
  const numCols = sheet.getLastColumn();
  const currentHeaders = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  sheet.getRange(1, 1, 1, numCols).setValues([currentHeaders.map(h => headerMap[h] || h)]);
  sheet.getRange(1, 1, 1, numCols)
    .setBackground('#0f766e').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 80);
  if (numCols >= 4) sheet.setColumnWidth(4, 140);
  if (numCols >= 5) sheet.setColumnWidth(5, 80);

  if (sheet.getLastRow() > 1) {
    const dataRange = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1);
    const workRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('稼働')
      .setBackground('#bbf7d0').setFontColor('#166534')
      .setRanges([dataRange]).build();
    const offRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('休日')
      .setBackground('#e5e7eb').setFontColor('#6b7280')
      .setRanges([dataRange]).build();
    sheet.setConditionalFormatRules([workRule, offRule]);

    sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).setHorizontalAlignment('center');
    for (let r = 2; r <= sheet.getLastRow(); r++) {
      sheet.getRange(r, 1, 1, 3).setBackground(r % 2 === 0 ? '#f0fdf4' : '#ffffff');
    }
  }

  sheet.setFrozenRows(1);
  if (sheet.getLastRow() > 1) {
    try { sheet.getFilter()?.remove(); } catch(e) {}
    sheet.getRange(1, 1, sheet.getLastRow(), numCols).createFilter();
  }
}

function formatMembersSheet() {
  const sheet = getSheet('メンバー設定');
  if (sheet.getLastRow() === 0) return;

  const numCols = sheet.getLastColumn();
  const headerMap = {
    id: 'ID', name: '氏名', role: '役割', target: '月間目標',
    isManager: '責任者', password: 'パスワード', planDays: '計画稼働日数',
  };
  const currentH = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  sheet.getRange(1, 1, 1, numCols).setValues([currentH.map(h => headerMap[h] || h)]);
  sheet.getRange(1, 1, 1, numCols)
    .setBackground('#7c3aed').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  [160, 80, 100, 90, 80, 120, 120].forEach((w, i) => {
    if (i + 1 <= numCols) sheet.setColumnWidth(i + 1, w);
  });

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).setHorizontalAlignment('center');
  }
  sheet.setFrozenRows(1);
}

function formatMonthlySummarySheet() {
  const sheet = getSheet('月次サマリー');
  if (sheet.getLastRow() === 0) return;

  const headerMap = {
    month: '月', name: '氏名', totalVisits: '訪問合計',
    totalNetMeet: '対面合計', totalMainMeet: '主権対面合計',
    totalNegotiation: '商談合計', totalAcquired: '獲得合計',
    workedDays: '稼働日数', productivity: '日次生産性',
    forecast: '着地予測', meetRate: '対面率', getRate: '獲得率',
    updatedAt: '更新日時',
  };
  const numCols = sheet.getLastColumn();
  const currentH = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  sheet.getRange(1, 1, 1, numCols).setValues([currentH.map(h => headerMap[h] || h)]);
  sheet.getRange(1, 1, 1, numCols)
    .setBackground('#0369a1').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  [80, 80, 80, 80, 110, 80, 80, 80, 100, 80, 70, 70, 140].forEach((w, i) => {
    if (i + 1 <= numCols) sheet.setColumnWidth(i + 1, w);
  });

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).setHorizontalAlignment('center');
    // 対面率・獲得率をパーセント表示（col 11, 12）
    if (numCols >= 12) {
      sheet.getRange(2, 11, sheet.getLastRow() - 1, 2).setNumberFormat('0.0%');
    }
    for (let r = 2; r <= sheet.getLastRow(); r++) {
      sheet.getRange(r, 1, 1, numCols).setBackground(r % 2 === 0 ? '#f0f9ff' : '#ffffff');
    }
  }

  sheet.setFrozenRows(1);
  if (sheet.getLastRow() > 1) {
    try { sheet.getFilter()?.remove(); } catch(e) {}
    sheet.getRange(1, 1, sheet.getLastRow(), numCols).createFilter();
  }
}
