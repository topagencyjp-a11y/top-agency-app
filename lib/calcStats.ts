import { Member } from './members';

export type MemberStats = {
  name: string;
  role: 'closer' | 'appointer';
  target: number;        // period-adjusted target
  acquired: number;
  workedDays: number;
  planDays: number;
  remainDays: number;
  visits: number;
  netMeet: number;
  mainMeet: number;
  negotiation: number;
  productivity: number;  // acquired / workedDays
  forecast: number;      // round(productivity * planDays)
  goalGap: number;       // forecast - target
  paceGap: number;       // acquired - expectedByNow
  neededPerDay: number;  // (target - acquired) / remainDays
  meetRate: number;      // 0-1
  getRate: number;       // 0-1
};

export type TeamStats = {
  totalAcquired: number;
  teamForecast: number;
  goalGap: number;
  paceGap: number;
  avgNeededPerDay: number; // per-person per-day
  avgRemainDays: number;
  totalVisits: number;
  totalNetMeet: number;
  totalMainMeet: number;
  totalNegotiation: number;
};

function n(val: unknown): number {
  return Number(val) || 0;
}

function sum(arr: Record<string, unknown>[], key: string): number {
  return arr.reduce((s, r) => s + n(r[key]), 0);
}

export function getPeriodReports(reports: Record<string, unknown>[], period: string): Record<string, unknown>[] {
  if (period === 'month') {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return reports.filter(r => String(r.date).startsWith(month));
  }
  if (period === 'week') {
    const today = new Date();
    const dow = today.getDay() || 7;
    const mon = new Date(today);
    mon.setDate(today.getDate() - dow + 1);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const start = mon.toISOString().slice(0, 10);
    const end = sun.toISOString().slice(0, 10);
    return reports.filter(r => {
      const d = String(r.date).slice(0, 10);
      return d >= start && d <= end;
    });
  }
  return reports.filter(r => String(r.date).startsWith(period));
}

function periodAdjustedTarget(monthlyTarget: number, period: string): number {
  if (period === 'week') return Math.ceil(monthlyTarget * 5 / 20);
  return monthlyTarget;
}

function calcExpectedByNow(target: number, period: string): number {
  const today = new Date();
  if (period === 'week') {
    const dow = Math.min(today.getDay() || 7, 5);
    return target * dow / 5;
  }
  const isCurrentMonth = period === 'month';
  const y = isCurrentMonth ? today.getFullYear() : Number(period.slice(0, 4));
  const m = isCurrentMonth ? today.getMonth() + 1 : Number(period.slice(5, 7));
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth;
  return target * dayOfMonth / daysInMonth;
}

export function calcMemberStats(
  periodReports: Record<string, unknown>[],
  member: Member,
  period: string
): MemberStats {
  const reports = periodReports.filter(r => r.name === member.name);

  const acquired    = sum(reports, 'acquired');
  const visits      = sum(reports, 'visits');
  const netMeet     = sum(reports, 'netMeet');
  const mainMeet    = sum(reports, 'mainMeet');
  const negotiation = sum(reports, 'negotiation');

  const workedDays = reports.filter(r => n(r.visits) > 0 || n(r.acquired) > 0).length;
  const latestPlanDays = reports.reduce((v, r) => n(r.planDays) > 0 ? n(r.planDays) : v, 0);
  const planDays   = latestPlanDays || (period === 'week' ? 5 : 20);
  const remainDays = Math.max(0, planDays - workedDays);

  const productivity = workedDays > 0 ? acquired / workedDays : 0;
  const forecast     = Math.round(productivity * planDays);

  const target   = periodAdjustedTarget(member.target, period);
  const goalGap  = forecast - target;
  const paceGap  = acquired - calcExpectedByNow(target, period);
  const neededPerDay = remainDays > 0
    ? (target - acquired) / remainDays
    : Math.max(0, target - acquired);

  const meetRate = visits > 0 ? netMeet / visits : 0;
  const getRate  = netMeet > 0 ? acquired / netMeet : 0;

  return {
    name: member.name,
    role: member.role,
    target,
    acquired,
    workedDays,
    planDays,
    remainDays,
    visits,
    netMeet,
    mainMeet,
    negotiation,
    productivity,
    forecast,
    goalGap,
    paceGap,
    neededPerDay,
    meetRate,
    getRate,
  };
}

export function calcTeamStats(memberStats: MemberStats[], teamTarget: number): TeamStats {
  const totalAcquired   = memberStats.reduce((s, m) => s + m.acquired, 0);
  const teamForecast    = memberStats.reduce((s, m) => s + m.forecast, 0);
  const goalGap         = teamForecast - teamTarget;
  const paceGap         = memberStats.reduce((s, m) => s + m.paceGap, 0);
  const totalRemain     = memberStats.reduce((s, m) => s + m.remainDays, 0);
  const memberCount     = memberStats.length || 1;
  const avgRemainDays   = totalRemain / memberCount;
  const avgNeededPerDay = avgRemainDays > 0
    ? (teamTarget - totalAcquired) / avgRemainDays / memberCount
    : Math.max(0, teamTarget - totalAcquired);

  return {
    totalAcquired,
    teamForecast,
    goalGap,
    paceGap,
    avgNeededPerDay,
    avgRemainDays: Math.round(avgRemainDays),
    totalVisits:      memberStats.reduce((s, m) => s + m.visits, 0),
    totalNetMeet:     memberStats.reduce((s, m) => s + m.netMeet, 0),
    totalMainMeet:    memberStats.reduce((s, m) => s + m.mainMeet, 0),
    totalNegotiation: memberStats.reduce((s, m) => s + m.negotiation, 0),
  };
}
