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

export async function getReports(name?: string) {
  try {
    const url = name ? `${GAS_URL}?action=getReports&name=${encodeURIComponent(name)}` : `${GAS_URL}?action=getReports`;
    const res = await fetch(url);
    const data = await res.json();
    return data.reports || [];
  } catch (e) {
    return [];
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
  } catch (e) {
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

export async function updatePasswordInGAS(id: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
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
