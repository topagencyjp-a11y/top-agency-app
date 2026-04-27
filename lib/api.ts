const GAS_URL = 'https://script.google.com/macros/s/AKfycbwYGlW-oq8FIAdsHhin4pqUZICN_Ju39mhwkyohDBi3LIFZUZUklNaVMxrluRC05oOCvw/exec';

function toLocalDateStr(val: string): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().slice(0, 10);
}

export async function saveReport(data: any) {
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveReport', ...data }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function getReports(
  params?: { name?: string; month?: string; week?: string } | string
) {
  try {
    const p = typeof params === 'string' ? { name: params } : (params || {});
    const query = new URLSearchParams({ action: 'getReports' });
    if (p.name)  query.set('name',  p.name);
    if (p.month) query.set('month', p.month);
    if (p.week)  query.set('week',  p.week);
    const res = await fetch(`${GAS_URL}?${query}`);
    const data = await res.json();
    return data.reports || [];
  } catch {
    return [];
  }
}

export async function getMonthlySummary(month: string) {
  try {
    const res = await fetch(`${GAS_URL}?action=getMonthlySummary&month=${encodeURIComponent(month)}`);
    const data = await res.json();
    return data.summary || [];
  } catch {
    return [];
  }
}

export async function adminUpdateReport(
  data: any,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'adminUpdateReport', ...data, adminName }),
    });
    return await res.json();
  } catch {
    return { success: false, error: '通信エラー' };
  }
}

export async function saveShift(name: string, date: string, status: string) {
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveShift', name, date, status }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function getShifts() {
  try {
    const res = await fetch(`${GAS_URL}?action=getShifts`);
    const data = await res.json();
    return (data.shifts || []).map((s: any) => ({ ...s, date: toLocalDateStr(String(s.date)) }));
  } catch {
    return [];
  }
}

export async function getMembersFromGAS() {
  try {
    const res = await fetch(`${GAS_URL}?action=getMembers`);
    const data = await res.json();
    return data.members || [];
  } catch {
    return [];
  }
}

export async function saveMembersToGAS(members: any[]) {
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveMembers', members }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function updatePasswordInGAS(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'updatePassword', id, currentPassword, newPassword }),
    });
    return await res.json();
  } catch {
    return { success: false, error: '通信エラー' };
  }
}
