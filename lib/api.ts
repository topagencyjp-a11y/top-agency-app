import type { Member, Team, MonthlyPlan } from './members';
import {
  sbSaveReport, sbGetReports, sbAdminUpdateReport,
  sbSaveShift,  sbGetShifts,
  sbGetMembers, sbSaveMembers,
  sbGetTeams,   sbSaveTeam, sbDeleteTeam,
  sbGetMonthlyPlans, sbSaveMonthlyPlan, sbSaveMonthlyPlans,
} from './supabase-db';
import { isSupabaseConfigured } from './supabase';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbz0KREckErCBIMvD-5yURsUh3CKVmGI5O3H2gkPtYB94QXpXn634o6y3lkTFBqqXPPBNw/exec';

function toLocalDateStr(val: string): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().slice(0, 10);
}

// ---- GAS 内部関数 ------------------------------------------

async function gasPost(body: Record<string, unknown>) {
  return fetch(GAS_URL, { method: 'POST', body: JSON.stringify(body) });
}

async function gasGet(params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return fetch(`${GAS_URL}?${q}`);
}

// ---- Reports -----------------------------------------------

export async function saveReport(data: Record<string, unknown>) {
  await Promise.allSettled([
    gasPost({ action: 'saveReport', ...data }),
    sbSaveReport(data),
  ]);
}

export async function getReports(
  params?: { name?: string; month?: string; week?: string } | string
): Promise<Record<string, unknown>[]> {
  const p = typeof params === 'string' ? { name: params } : (params ?? {});

  // Supabase優先: データがあればそちらを返す
  if (isSupabaseConfigured()) {
    const sbRows = await sbGetReports(p);
    if (sbRows.length > 0) return sbRows;
  }

  // GASフォールバック
  try {
    const query: Record<string, string> = { action: 'getReports' };
    if (p.name)  query.name  = p.name;
    if (p.month) query.month = p.month;
    if (p.week)  query.week  = p.week;
    const res  = await gasGet(query);
    const data = await res.json();
    return data.reports ?? [];
  } catch { return []; }
}

export async function getMonthlySummary(month: string) {
  try {
    const res  = await gasGet({ action: 'getMonthlySummary', month });
    const data = await res.json();
    return data.summary ?? [];
  } catch { return []; }
}

export async function adminUpdateReport(
  data: Record<string, unknown>,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  const [gasRes, sbRes] = await Promise.allSettled([
    gasPost({ action: 'adminUpdateReport', ...data, adminName }).then(r => r.json()),
    sbAdminUpdateReport(data, adminName),
  ]);

  const gasFailed = gasRes.status === 'rejected' || !(gasRes.value as { success?: boolean })?.success;
  const sbOk      = sbRes.status === 'fulfilled' && (sbRes.value as { success: boolean }).success;

  if (!gasFailed) return { success: true };
  if (sbOk)       return { success: true };
  return { success: false, error: '通信エラー' };
}

// ---- Shifts ------------------------------------------------

export async function saveShift(name: string, date: string, status: string) {
  await Promise.allSettled([
    gasPost({ action: 'saveShift', name, date, status }),
    sbSaveShift(name, date, status),
  ]);
}

export async function getShifts(): Promise<{ name: string; date: string; status: string }[]> {
  if (isSupabaseConfigured()) {
    const sbRows = await sbGetShifts();
    if (sbRows.length > 0) {
      return sbRows.map(s => ({
        name:   String(s.name ?? ''),
        date:   toLocalDateStr(String(s.date ?? '')),
        status: String(s.status ?? ''),
      }));
    }
  }

  try {
    const res  = await gasGet({ action: 'getShifts' });
    const data = await res.json();
    return (data.shifts ?? []).map((s: Record<string, unknown>) => ({
      name:   String(s.name ?? ''),
      date:   toLocalDateStr(String(s.date ?? '')),
      status: String(s.status ?? ''),
    }));
  } catch { return []; }
}

// ---- Members -----------------------------------------------

export async function getMembersFromGAS(): Promise<Member[]> {
  if (isSupabaseConfigured()) {
    const sbRows = await sbGetMembers();
    if (sbRows.length > 0) return sbRows as unknown as Member[];
  }

  try {
    const res  = await gasGet({ action: 'getMembers' });
    const data = await res.json();
    return data.members ?? [];
  } catch { return []; }
}

export async function saveMembersToGAS(members: Member[]): Promise<void> {
  await Promise.allSettled([
    gasPost({ action: 'saveMembers', members }),
    sbSaveMembers(members as unknown as Record<string, unknown>[]),
  ]);
}

// ---- Teams -------------------------------------------------

export async function getTeams(): Promise<Team[]> {
  if (isSupabaseConfigured()) {
    const sbRows = await sbGetTeams();
    if (sbRows.length > 0) return sbRows;
  }

  try {
    const res  = await gasGet({ action: 'getTeams' });
    const data = await res.json();
    return data.teams ?? [];
  } catch { return []; }
}

export async function saveTeam(
  d: { teamId?: string; teamName: string }
): Promise<{ success: boolean; teamId?: string }> {
  const [gasRes, sbRes] = await Promise.allSettled([
    gasPost({ action: 'saveTeam', ...d }).then(r => r.json()),
    sbSaveTeam(d),
  ]);

  if (sbRes.status === 'fulfilled' && (sbRes.value as { success: boolean }).success) {
    return sbRes.value as { success: boolean; teamId?: string };
  }
  if (gasRes.status === 'fulfilled') return gasRes.value as { success: boolean; teamId?: string };
  return { success: false };
}

export async function deleteTeam(teamId: string): Promise<{ success: boolean }> {
  await Promise.allSettled([
    gasPost({ action: 'deleteTeam', teamId }),
    sbDeleteTeam(teamId),
  ]);
  return { success: true };
}

// ---- Monthly Plans -----------------------------------------

export async function getMonthlyPlans(month: string): Promise<MonthlyPlan[]> {
  if (isSupabaseConfigured()) {
    const sbRows = await sbGetMonthlyPlans(month);
    if (sbRows.length > 0) return sbRows;
  }

  try {
    const res  = await gasGet({ action: 'getMonthlyPlans', month });
    const data = await res.json();
    return data.plans ?? [];
  } catch { return []; }
}

export async function saveMonthlyPlan(d: MonthlyPlan): Promise<{ success: boolean }> {
  await Promise.allSettled([
    gasPost({ action: 'saveMonthlyPlan', ...d }),
    sbSaveMonthlyPlan(d),
  ]);
  return { success: true };
}

export async function saveMonthlyPlans(plans: MonthlyPlan[]): Promise<{ success: boolean }> {
  await Promise.allSettled([
    gasPost({ action: 'saveMonthlyPlans', plans }),
    sbSaveMonthlyPlans(plans),
  ]);
  return { success: true };
}

// ---- Password ----------------------------------------------

export async function updatePasswordInGAS(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res  = await gasPost({ action: 'updatePassword', id, currentPassword, newPassword });
    return await res.json();
  } catch { return { success: false, error: '通信エラー' }; }
}

// ---- Export ------------------------------------------------

export async function syncToReportSheet(params: {
  month: string;
  spreadsheetId: string;
  exportTypes: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'syncToReportSheet', ...params }),
    });
    return await res.json();
  } catch { return { success: false, error: '通信エラー' }; }
}

export async function createAndSyncReportSheet(params: {
  month: string;
  exportTypes: string[];
  folderId?: string;
}): Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; title?: string; error?: string }> {
  try {
    const res = await gasPost({ action: 'createAndSyncReportSheet', ...params });
    return await res.json();
  } catch { return { success: false, error: '通信エラー' }; }
}

// ---- Utilities ---------------------------------------------

export function getAvailableMonths(reports: Record<string, unknown>[]): string[] {
  const months = new Set<string>();
  reports.forEach(r => {
    const d = String(r.date).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(d)) months.add(d);
  });
  return Array.from(months).sort().reverse();
}
