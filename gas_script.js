const SPREADSHEET_ID = '1Ahyt22lcq6C0BvFgX_9OgdGfCtagI_ZlGW0knEZd86s';

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
    const name = e.parameter.name;
    result = getReports(name);
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
  } else {
    result = { error: 'unknown action' };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getReports(filterName) {
  const sheet = getSheet('reports');
  const rows = sheet.getDataRange().getValues();
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
  const sheet = getSheet('reports');
  const rows = sheet.getDataRange().getValues();
  const headers = rows.length > 0 ? rows[0] : [
    'name','date','visits','netMeet','mainMeet','negotiation','acquired',
    'startTime','endTime','acquiredCase','lostCase','goodPoints','issues',
    'improvements','learnings','gratitude','planDays'
  ];
  if (rows.length === 0) sheet.appendRow(headers);

  const rowValues = headers.map(h => data[h] !== undefined ? data[h] : '');
  const allRows = sheet.getDataRange().getValues();

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

function getShifts() {
  const sheet = getSheet('shifts');
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { shifts: [] };
  const headers = rows[0];
  const shifts = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return { shifts };
}

function saveShift(data) {
  const sheet = getSheet('shifts');
  const rows = sheet.getDataRange().getValues();
  if (rows.length === 0) {
    sheet.appendRow(['name', 'date', 'status']);
  }

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

function getMembers() {
  const sheet = getSheet('メンバー設定');
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { members: [] };
  const headers = rows[0];
  const members = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    if (obj.target !== undefined) obj.target = Number(obj.target) || 0;
    if (obj.isManager !== undefined) obj.isManager = obj.isManager === true || obj.isManager === 'true' || obj.isManager === 'TRUE';
    return obj;
  });
  return { members };
}

function saveMembers(members) {
  const sheet = getSheet('メンバー設定');
  sheet.clearContents();
  const headers = ['id', 'name', 'role', 'target', 'isManager'];
  sheet.appendRow(headers);
  members.forEach(m => {
    sheet.appendRow([m.id || '', m.name || '', m.role || 'closer', m.target || 0, m.isManager || false]);
  });
  return { success: true };
}
