-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  NewFin — מערכת זהות + מעקב שימוש + ניהול                          ║
-- ║  הרץ פעם אחת ב-Supabase SQL Editor (בטוח להריץ שוב — idempotent).   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── 1. תפקיד מנהל בטבלת users ──────────────────────────────────────
alter table public.users add column if not exists is_admin boolean not null default false;
alter table public.users add column if not exists last_seen timestamptz;

-- ── 2. יצירת פרופיל אוטומטית בכל הרשמה ──────────────────────────────
-- טריגר על auth.users: כל מי שנכנס לראשונה מקבל שורה ב-public.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- מילוי לאחור: משתמשים שכבר נרשמו לפני הטריגר
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ── 3. בדיקת מנהל ללא רקורסיית RLS ──────────────────────────────────
-- security definer = רץ בהרשאות הבעלים ועוקף RLS, כך שאין לולאה אינסופית
-- (הבעיה הידועה 42P17) כשמדיניות על users קוראת ל-users.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

-- ── 4. טבלת אירועי שימוש (מעקב מאוזן) ───────────────────────────────
-- שורה אחת לאירוע: login / page_view / search / watch_add / watch_remove.
-- meta = פרטים קלים (נתיב, מילת חיפוש, מזהה מניה). נשמר רזה בכוונה.
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete cascade,
  type text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_type_idx on public.usage_events (type, created_at desc);
create index if not exists usage_events_created_idx on public.usage_events (created_at);

-- ── 5. RLS ──────────────────────────────────────────────────────────
-- users: כל אחד רואה/מעדכן את עצמו; מנהל רואה את כולם.
alter table public.users enable row level security;
drop policy if exists "own user row" on public.users;
create policy "own user row" on public.users for select using (auth.uid() = id);
drop policy if exists "admin reads all users" on public.users;
create policy "admin reads all users" on public.users for select using (public.is_admin());
drop policy if exists "update own user row" on public.users;
create policy "update own user row" on public.users for update using (auth.uid() = id);

-- usage_events: כל אחד כותב רק את האירועים שלו; רק מנהל קורא.
alter table public.usage_events enable row level security;
drop policy if exists "insert own events" on public.usage_events;
create policy "insert own events" on public.usage_events for insert
  with check (auth.uid() = user_id);
drop policy if exists "admin reads events" on public.usage_events;
create policy "admin reads events" on public.usage_events for select
  using (public.is_admin());

-- ── 6. ניקוי אוטומטי (שמירת הקרדיטים) ───────────────────────────────
-- מוחק אירועים מעל 60 יום. רץ אוטומטית אם pg_cron מותקן (ראה למטה).
create or replace function public.prune_usage_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.usage_events where created_at < now() - interval '60 days';
$$;

-- אופציונלי — תזמון יומי (דורש extension pg_cron מופעל ב-Database → Extensions):
--   select cron.schedule('prune-usage-events', '0 4 * * *',
--          $$ select public.prune_usage_events() $$);

-- ── 7. סימון מנהלים ─────────────────────────────────────────────────
-- שי מסומן כמנהל. הוסף את המייל של מיכל אחרי שהיא נכנסת פעם ראשונה.
update public.users set is_admin = true where email = '1979shay@gmail.com';
-- update public.users set is_admin = true where email = 'michal@example.com';

-- ── 8. תצוגת סיכום למנהל (אופציונלי, נוחות) ─────────────────────────
-- מאחדת לכל משתמש: כניסה אחרונה, מס' אירועים, מס' מניות במעקב.
create or replace view public.admin_user_stats
with (security_invoker = true) as
select
  u.id,
  u.email,
  u.tier,
  u.is_admin,
  u.created_at,
  u.last_seen,
  (select count(*) from public.usage_events e where e.user_id = u.id) as event_count,
  (select count(*) from public.usage_events e where e.user_id = u.id and e.type = 'login') as login_count,
  (select count(*) from public.watchlist w where w.user_id = u.id) as watch_count
from public.users u;
