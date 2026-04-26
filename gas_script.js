const SPREADSHEET_ID = '1Ahyt22lcq6C0BvFgX_9OgdGfCtagI_ZlGW0knEZd86s';
const MANAGER_PASSWORD = 'topMgr2024!';

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
  if (action === 'saveReport') {
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

// ── 認証 ──────────────────────────────────────────────

function getAccount(name, password) {
  if (!name || !password) return { account: null };

  const isManagerPw = password === MANAGER_PASSWORD;
  const sheet = getSheet('メンバー設定');
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { account: null };

  const headers = rows[0];
  const nameIdx = headers.indexOf('name');
  const pwIdx   = headers.indexOf('password');
  const idIdx   = headers.indexOf('id');
  const roleIdx = headers.indexOf('role');
  const mgIdx   = headers.indexOf('isManager');

  // passwordカラムがなければ自動追加
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
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: false };

  const headers = rows[0];
  const idIdx   = headers.indexOf('id');
  const pwIdx   = headers.indexOf('password');

  if (pwIdx < 0) return { success: false, error: 'パスワード列がありません' };

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) !== id) continue;
    if (String(rows[i][pwIdx]) !== currentPassword) {
      return { success: false, error: '現在のパスワードが違います' };
    }
    sheet.getRange(i + 1, pwIdx + 1).setValue(newPassword);
    return { success: true };
  }
  return { success: false, error: 'メンバーが見つかりません' };
}

function migrateAddPasswordColumn() {
  const sheet   = getSheet('メンバー設定');
  const rows    = sheet.getDataRange().getValues();
  if (rows.length <= 0) return;
  const headers = rows[0];
  if (headers.indexOf('password') >= 0) return;
  const col = headers.length + 1;
  sheet.getRange(1, col).setValue('password');
  for (let i = 1; i < rows.length; i++) {
    sheet.getRange(i + 1, col).setValue('top2024');
  }
}

// ── メンバー ──────────────────────────────────────────

function getMembers() {
  const sheet = getSheet('メンバー設定');
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { members: [] };
  const headers = rows[0];
  const members = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    if (obj.target !== undefined) obj.target = Number(obj.target) || 0;
    if (obj.isManager !== undefined)
      obj.isManager = obj.isManager === true || obj.isManager === 'true' || obj.isManager === 'TRUE';
    delete obj.password; // パスワードは返さない
    return obj;
  });
  return { members };
}

function saveMembers(members) {
  const sheet = getSheet('メンバー設定');

  // 既存パスワードを保持
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

// ── 日次報告 ───────────────────────────────────────────

function getReports(filterName) {
  const sheet = getSheet('reports');
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { reports: [] };
  const headers = rows[0];
  const reports = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(r => !filterName || r.name === filterName);
  return { reports };
}

function saveReport(data) {
  const sheet   = getSheet('reports');
  const rows    = sheet.getDataRange().getValues();
  const headers = rows.length > 0 ? rows[0] : [
    'name','date','visits','netMeet','mainMeet','negotiation','acquired',
    'startTime','endTime','acquiredCase','lostCase','goodPoints','issues',
    'improvements','learnings','gratitude','planDays'
  ];
  if (rows.length === 0) sheet.appendRow(headers);

  const rowValues = headers.map(h => data[h] !== undefined ? data[h] : '');
  const allRows   = sheet.getDataRange().getValues();

  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][headers.indexOf('name')] === data.name &&
        allRows[i][headers.indexOf('date')] === data.date) {
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowValues]);
      return { success: true };
    }
  }
  sheet.appendRow(rowValues);
  return { success: true };
}

// ── シフト ────────────────────────────────────────────

function getShifts() {
  const sheet = getSheet('shifts');
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { shifts: [] };
  const headers = rows[0];
  const shifts  = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return { shifts };
}

function saveShift(data) {
  const sheet = getSheet('shifts');
  const rows  = sheet.getDataRange().getValues();
  if (rows.length === 0) sheet.appendRow(['name', 'date', 'status']);

  const allRows = sheet.getDataRange().getValues();
  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][0] === data.name && allRows[i][1] === data.date) {
      sheet.getRange(i + 1, 3).setValue(data.status);
      return { success: true };
    }
  }
  sheet.appendRow([data.name, data.date, data.status]);
  return { success: true };
}
