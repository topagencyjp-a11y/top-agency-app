import type { Team, MonthlyPlan } from './members';

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

export function getAvailableMonths(reports: Record<string, unknown>[]): string[] {
  const months = new Set<string>();
  reports.forEach(r => {
    const d = String(r.date).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(d)) months.add(d);
  });
  return Array.from(months).sort().reverse();
}

export async function getTeams(): Promise<Team[]> {
  try {
    const res = await fetch(`${GAS_URL}?action=getTeams`);
    const data = await res.json();
    return data.teams || [];
  } catch { return []; }
}

export async function saveTeam(d: { teamId?: string; teamName: string }): Promise<{ success: boolean; teamId?: string }> {
  try {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveTeam', ...d }) });
    return await res.json();
  } catch { return { success: false }; }
}

export async function deleteTeam(teamId: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteTeam', teamId }) });
    return await res.json();
  } catch { return { success: false }; }
}

export async function getMonthlyPlans(month: string): Promise<MonthlyPlan[]> {
  try {
    const res = await fetch(`${GAS_URL}?action=getMonthlyPlans&month=${encodeURIComponent(month)}`);
    const data = await res.json();
    return data.plans || [];
  } catch { return []; }
}

export async function saveMonthlyPlan(d: MonthlyPlan): Promise<{ success: boolean }> {
  try {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveMonthlyPlan', ...d }) });
    return await res.json();
  } catch { return { success: false }; }
}

export async function saveMonthlyPlans(plans: MonthlyPlan[]): Promise<{ success: boolean }> {
  try {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveMonthlyPlans', plans }) });
    return await res.json();
  } catch { return { success: false }; }
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
