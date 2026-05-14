import { supabase, isSupabaseConfigured } from './supabase';
import type { Team, MonthlyPlan } from './members';

// ---- 型変換ヘルパー ----------------------------------------

function toSnakeReport(d: Record<string, unknown>) {
  return {
    name:          d.name,
    date:          d.date,
    visits:        Number(d.visits        ?? 0),
    net_meet:      Number(d.netMeet       ?? 0),
    main_meet:     Number(d.mainMeet      ?? 0),
    negotiation:   Number(d.negotiation   ?? 0),
    acquired:      Number(d.acquired      ?? 0),
    start_time:    d.startTime   ?? '',
    end_time:      d.endTime     ?? '',
    acquired_case: d.acquiredCase ?? '',
    lost_case:     d.lostCase    ?? '',
    good_points:   d.goodPoints  ?? '',
    issues:        d.issues      ?? '',
    improvements:  d.improvements ?? '',
    learnings:     d.learnings   ?? '',
    gratitude:     d.gratitude   ?? '',
    plan_days:     Number(d.planDays ?? 0),
    area1:  d.area1  ?? '', area2:  d.area2  ?? '', area3:  d.area3  ?? '',
    area4:  d.area4  ?? '', area5:  d.area5  ?? '', area6:  d.area6  ?? '',
    area7:  d.area7  ?? '', area8:  d.area8  ?? '', area9:  d.area9  ?? '',
    area10: d.area10 ?? '',
    updated_at: d.updatedAt ?? new Date().toISOString(),
    updated_by: d.updatedBy ?? '',
  };
}

function toCamelReport(r: Record<string, unknown>) {
  return {
    name:         r.name,
    date:         r.date,
    visits:       r.visits,
    netMeet:      r.net_meet,
    mainMeet:     r.main_meet,
    negotiation:  r.negotiation,
    acquired:     r.acquired,
    startTime:    r.start_time,
    endTime:      r.end_time,
    acquiredCase: r.acquired_case,
    lostCase:     r.lost_case,
    goodPoints:   r.good_points,
    issues:       r.issues,
    improvements: r.improvements,
    learnings:    r.learnings,
    gratitude:    r.gratitude,
    planDays:     r.plan_days,
    area1: r.area1, area2: r.area2, area3: r.area3,
    area4: r.area4, area5: r.area5, area6: r.area6,
    area7: r.area7, area8: r.area8, area9: r.area9, area10: r.area10,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
  };
}

function toCamelMember(m: Record<string, unknown>) {
  return {
    id:                 m.id,
    name:               m.name,
    role:               m.role,
    target:             m.target,
    isManager:          m.is_manager,
    teamId:             m.team_id,
    planDays:           m.plan_days,
    password:           m.password,
    workedDaysOverride: m.worked_days_override,
  };
}

function toSnakeMember(m: Record<string, unknown>) {
  return {
    id:                   m.id,
    name:                 m.name,
    role:                 m.role,
    target:               Number(m.target ?? 0),
    is_manager:           Boolean(m.isManager),
    team_id:              m.teamId    ?? '',
    plan_days:            Number(m.planDays ?? 0),
    password:             m.password  ?? '',
    worked_days_override: m.workedDaysOverride ?? null,
  };
}

// ---- Reports -----------------------------------------------

export async function sbSaveReport(data: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const row = toSnakeReport(data);
  const { error } = await supabase
    .from('reports')
    .upsert(row, { onConflict: 'name,date' });
  if (error) console.error('[Supabase] saveReport:', error.message);
}

export async function sbGetReports(
  params: { name?: string; month?: string; week?: string } = {}
): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  let q = supabase.from('reports').select('*');
  if (params.name)  q = q.eq('name', params.name);
  if (params.month) q = q.gte('date', `${params.month}-01`).lte('date', `${params.month}-31`);
  if (params.week)  {
    const base = new Date(params.week);
    const mon  = new Date(base); mon.setDate(base.getDate() - base.getDay() + 1);
    const sun  = new Date(mon);  sun.setDate(mon.getDate() + 6);
    q = q.gte('date', mon.toISOString().slice(0,10)).lte('date', sun.toISOString().slice(0,10));
  }
  const { data, error } = await q.order('date', { ascending: false });
  if (error) { console.error('[Supabase] getReports:', error.message); return []; }
  return (data ?? []).map(toCamelReport);
}

export async function sbAdminUpdateReport(
  data: Record<string, unknown>,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) return { success: false };
  const row = { ...toSnakeReport(data), updated_by: adminName, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('reports')
    .upsert(row, { onConflict: 'name,date' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---- Shifts ------------------------------------------------

export async function sbSaveShift(name: string, date: string, status: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('shifts')
    .upsert({ name, date, status }, { onConflict: 'name,date' });
  if (error) console.error('[Supabase] saveShift:', error.message);
}

export async function sbGetShifts(): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase.from('shifts').select('*');
  if (error) { console.error('[Supabase] getShifts:', error.message); return []; }
  return data ?? [];
}

// ---- Members -----------------------------------------------

export async function sbGetMembers(): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase.from('members').select('*');
  if (error) { console.error('[Supabase] getMembers:', error.message); return []; }
  return (data ?? []).map(toCamelMember);
}

export async function sbSaveMembers(members: Record<string, unknown>[]): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const rows = members.map(toSnakeMember);
  const { error } = await supabase.from('members').upsert(rows, { onConflict: 'id' });
  if (error) console.error('[Supabase] saveMembers:', error.message);
}

// ---- Teams -------------------------------------------------

export async function sbGetTeams(): Promise<Team[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase.from('teams').select('*');
  if (error) { console.error('[Supabase] getTeams:', error.message); return []; }
  return (data ?? []).map(r => ({ teamId: String(r.team_id), teamName: String(r.team_name) }));
}

export async function sbSaveTeam(d: { teamId?: string; teamName: string }): Promise<{ success: boolean; teamId?: string }> {
  if (!isSupabaseConfigured() || !supabase) return { success: false };
  const teamId = d.teamId ?? crypto.randomUUID();
  const { error } = await supabase
    .from('teams')
    .upsert({ team_id: teamId, team_name: d.teamName }, { onConflict: 'team_id' });
  if (error) return { success: false };
  return { success: true, teamId };
}

export async function sbDeleteTeam(teamId: string): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured() || !supabase) return { success: false };
  const { error } = await supabase.from('teams').delete().eq('team_id', teamId);
  if (error) return { success: false };
  return { success: true };
}

// ---- Monthly Plans -----------------------------------------

export async function sbGetMonthlyPlans(month: string): Promise<MonthlyPlan[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase.from('monthly_plans').select('*').eq('month', month);
  if (error) { console.error('[Supabase] getMonthlyPlans:', error.message); return []; }
  return (data ?? []).map(r => ({
    memberId:           String(r.member_id),
    month:              String(r.month),
    planDays:           Number(r.plan_days),
    monthlyTarget:      Number(r.monthly_target),
    workedDaysOverride: r.worked_days_override != null ? Number(r.worked_days_override) : undefined,
    submittedBy:        String(r.submitted_by),
  }));
}

export async function sbSaveMonthlyPlan(d: MonthlyPlan): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured() || !supabase) return { success: false };
  const { error } = await supabase.from('monthly_plans').upsert({
    member_id:            d.memberId,
    month:                d.month,
    plan_days:            d.planDays,
    monthly_target:       d.monthlyTarget,
    worked_days_override: d.workedDaysOverride ?? null,
    submitted_by:         d.submittedBy,
  }, { onConflict: 'member_id,month' });
  if (error) return { success: false };
  return { success: true };
}

export async function sbSaveMonthlyPlans(plans: MonthlyPlan[]): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured() || !supabase) return { success: false };
  const rows = plans.map(d => ({
    member_id:            d.memberId,
    month:                d.month,
    plan_days:            d.planDays,
    monthly_target:       d.monthlyTarget,
    worked_days_override: d.workedDaysOverride ?? null,
    submitted_by:         d.submittedBy,
  }));
  const { error } = await supabase.from('monthly_plans').upsert(rows, { onConflict: 'member_id,month' });
  if (error) return { success: false };
  return { success: true };
}
