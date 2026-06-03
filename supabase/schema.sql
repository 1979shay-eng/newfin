-- ╔══════════════════════════════════════════════════════════════╗
-- ║  NewFin — סכמת מסד נתונים (Supabase / Postgres)                ║
-- ║  ראה BLUEPRINT.md סעיף 2 למודל הנתונים המלא.                   ║
-- ║  הרץ ב-SQL Editor של Supabase על מסד נקי.                      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── הרחבות ──────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ── טיפוסי enum ─────────────────────────────────────────────────
do $$ begin create type source_type as enum ('osint','humint','finint'); exception when duplicate_object then null; end $$;
do $$ begin create type reliability as enum ('verified','reported','estimate'); exception when duplicate_object then null; end $$;
do $$ begin create type direction as enum ('bull','bear','neutral'); exception when duplicate_object then null; end $$;
do $$ begin create type item_status as enum ('draft','published'); exception when duplicate_object then null; end $$;
do $$ begin create type user_tier as enum ('free','premium'); exception when duplicate_object then null; end $$;

-- ── מקורות ──────────────────────────────────────────────────────
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type source_type not null,
  subtype text,
  reliability_default reliability not null default 'reported',
  base_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── חברות ───────────────────────────────────────────────────────
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  maya_company_id text unique,
  name_he text not null,
  name_en text,
  sector text,
  slug text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── ניירות ערך ──────────────────────────────────────────────────
create table if not exists securities (
  id uuid primary key default gen_random_uuid(),
  maya_paper_id text unique,
  company_id uuid references companies(id) on delete cascade,
  symbol text,
  name text,
  created_at timestamptz not null default now()
);

-- ── אשכולות (הצלבת מקורות) ───────────────────────────────────────
create table if not exists clusters (
  id uuid primary key default gen_random_uuid(),
  headline text,
  company_id uuid references companies(id) on delete set null,
  confidence numeric,
  first_seen timestamptz,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

-- ── פריטים (★ יחידת הליבה של הפיד) ───────────────────────────────
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  security_id uuid references securities(id) on delete set null,
  cluster_id uuid references clusters(id) on delete set null,
  maya_report_id text unique,
  title text not null,
  body text not null default '',
  bottom_line text,
  original_url text,
  published_at timestamptz not null default now(),
  source_type source_type not null,
  reliability reliability not null default 'reported',
  materiality_score smallint not null default 5 check (materiality_score between 1 and 10),
  direction direction not null default 'neutral',
  status item_status not null default 'draft',
  is_public boolean not null default false,
  lang text not null default 'he',
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists items_published_idx on items (published_at desc);
create index if not exists items_company_idx on items (company_id);
create index if not exists items_score_idx on items (materiality_score desc);
create index if not exists items_status_public_idx on items (status, is_public);

-- ── תגיות ───────────────────────────────────────────────────────
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name_he text not null,
  name_en text,
  type text not null default 'topic',
  slug text unique
);
create table if not exists item_tags (
  item_id uuid references items(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

-- ── לוח אירועים ──────────────────────────────────────────────────
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  type text not null,
  title text not null,
  event_date date not null,
  source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists events_date_idx on events (event_date);

-- ── מעקב בעלי עניין ──────────────────────────────────────────────
create table if not exists insider_moves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  actor text,
  role text,
  action text,
  quantity numeric,
  value numeric,
  reported_at timestamptz,
  source text,
  created_at timestamptz not null default now()
);

-- ── נתוני מחיר ───────────────────────────────────────────────────
create table if not exists prices (
  security_id uuid references securities(id) on delete cascade,
  date date not null,
  open numeric, high numeric, low numeric, close numeric,
  volume bigint,
  primary key (security_id, date)
);
create table if not exists anomalies (
  id uuid primary key default gen_random_uuid(),
  security_id uuid references securities(id) on delete cascade,
  date date not null,
  type text,
  magnitude numeric,
  note text
);

-- ── משתמשים ומונטיזציה ───────────────────────────────────────────
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  tier user_tier not null default 'free',
  created_at timestamptz not null default now()
);
create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  date date not null,
  content text,
  channel text not null default 'web',
  sent_at timestamptz
);
create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default false,
  premium_only boolean not null default false,
  description text
);

-- ── RLS (אבטחת שורות) ────────────────────────────────────────────

-- פריטים: אנונימי רואה רק ציבורי; מחובר רואה הכל מפורסם
alter table items enable row level security;
drop policy if exists "items public read" on items;
create policy "items public read" on items for select to anon
  using (status = 'published' and is_public = true);
drop policy if exists "items member read" on items;
create policy "items member read" on items for select to authenticated
  using (status = 'published');

-- תוכן ציבורי לקריאה חופשית
do $$
declare t text;
begin
  foreach t in array array[
    'sources','companies','securities','tags','item_tags','clusters',
    'events','insider_moves','prices','anomalies','feature_flags'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "%s read" on %I;', t, t);
    execute format('create policy "%s read" on %I for select using (true);', t, t);
  end loop;
end $$;

-- משתמשים — בעלות אישית
alter table users enable row level security;
drop policy if exists "own user row" on users;
create policy "own user row" on users for select using (auth.uid() = id);
drop policy if exists "update own user row" on users;
create policy "update own user row" on users for update using (auth.uid() = id);

alter table watchlist enable row level security;
drop policy if exists "own watchlist" on watchlist;
create policy "own watchlist" on watchlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table briefs enable row level security;
drop policy if exists "own briefs" on briefs;
create policy "own briefs" on briefs for select using (auth.uid() = user_id);
