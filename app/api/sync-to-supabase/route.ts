import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  sbSaveReport, sbSaveShift, sbSaveMembers,
  sbSaveTeam, sbSaveMonthlyPlan,
} from '@/lib/supabase-db';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwYGlW-oq8FIAdsHhin4pqUZICN_Ju39mhwkyohDBi3LIFZUZUklNaVMxrluRC05oOCvw/exec';

async function gasGet(action: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ action, ...extra });
  const res = await fetch(`${GAS_URL}?${q}`);
  return res.json();
}

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Supabase未設定' }, { status: 400 });
  }

  const result = {
    reports: 0, shifts: 0, members: 0, teams: 0, monthlyPlans: 0, errors: [] as string[],
  };

  // ---- reports ----
  try {
    const data = await gasGet('getReports');
    const reports: Record<string, unknown>[] = data.reports ?? [];
    for (const r of reports) {
      await sbSaveReport(r);
      result.reports++;
    }
  } catch (e) { result.errors.push(`reports: ${e}`); }

  // ---- shifts ----
  try {
    const data = await gasGet('getShifts');
    const shifts: { name: string; date: string; status: string }[] = data.shifts ?? [];
    for (const s of shifts) {
      await sbSaveShift(s.name, String(s.date), s.status);
      result.shifts++;
    }
  } catch (e) { result.errors.push(`shifts: ${e}`); }

  // ---- members ----
  try {
    const data = await gasGet('getMembers');
    const members: Record<string, unknown>[] = data.members ?? [];
    await sbSaveMembers(members);
    result.members = members.length;
  } catch (e) { result.errors.push(`members: ${e}`); }

  // ---- teams ----
  try {
    const data = await gasGet('getTeams');
    const teams: { teamId: string; teamName: string }[] = data.teams ?? [];
    for (const t of teams) {
      await sbSaveTeam(t);
      result.teams++;
    }
  } catch (e) { result.errors.push(`teams: ${e}`); }

  // ---- monthly_plans (直近12ヶ月分) ----
  try {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const data = await gasGet('getMonthlyPlans', { month });
      const plans: Record<string, unknown>[] = data.plans ?? [];
      for (const p of plans) {
        await sbSaveMonthlyPlan({
          memberId:           String(p.memberId),
          month:              String(p.month),
          planDays:           Number(p.planDays ?? 0),
          monthlyTarget:      Number(p.monthlyTarget ?? 0),
          workedDaysOverride: p.workedDaysOverride != null ? Number(p.workedDaysOverride) : undefined,
          submittedBy:        String(p.submittedBy ?? ''),
        });
        result.monthlyPlans++;
      }
    }
  } catch (e) { result.errors.push(`monthlyPlans: ${e}`); }

  return NextResponse.json({ success: true, ...result });
}
