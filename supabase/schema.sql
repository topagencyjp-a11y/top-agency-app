-- =============================================
-- TOP Agency - Supabase Schema
-- Supabaseの「SQL Editor」でこのファイルを貼り付けて実行する
-- =============================================

-- reports テーブル（日報・行動量）
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  date         date not null,
  visits       int  default 0,
  net_meet     int  default 0,
  main_meet    int  default 0,
  negotiation  int  default 0,
  acquired     int  default 0,
  start_time   text default '',
  end_time     text default '',
  acquired_case text default '',
  lost_case     text default '',
  good_points   text default '',
  issues        text default '',
  improvements  text default '',
  learnings     text default '',
  gratitude     text default '',
  plan_days     int  default 0,
  area1  text default '', area2  text default '', area3  text default '',
  area4  text default '', area5  text default '', area6  text default '',
  area7  text default '', area8  text default '', area9  text default '',
  area10 text default '',
  updated_at    timestamptz default now(),
  updated_by    text default '',
  unique(name, date)
);

-- shifts テーブル
create table if not exists shifts (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  date   date not null,
  status text default '',
  unique(name, date)
);

-- members テーブル
create table if not exists members (
  id                   text primary key,
  name                 text not null,
  role                 text not null default 'closer',
  target               int  default 0,
  is_manager           boolean default false,
  team_id              text default '',
  plan_days            int  default 0,
  password             text default '',
  worked_days_override int
);

-- teams テーブル
create table if not exists teams (
  team_id   text primary key,
  team_name text not null
);

-- monthly_plans テーブル
create table if not exists monthly_plans (
  id                   uuid primary key default gen_random_uuid(),
  member_id            text not null,
  month                text not null,
  plan_days            int  default 0,
  monthly_target       int  default 0,
  worked_days_override int,
  submitted_by         text default '',
  unique(member_id, month)
);

-- RLS（Row Level Security）は無効のまま — anon keyで全操作を許可
alter table reports       disable row level security;
alter table shifts        disable row level security;
alter table members       disable row level security;
alter table teams         disable row level security;
alter table monthly_plans disable row level security;
