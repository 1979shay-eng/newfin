-- ── נתוני זרע ראשוניים ל-NewFin ──────────────────────────────────
-- הרץ אחרי schema.sql.

insert into sources (name, type, subtype, reliability_default, base_url) values
  ('מאיה',          'osint',  'official_report', 'verified', 'https://maya.tase.co.il'),
  ('גלובס',         'osint',  'media',           'reported', 'https://www.globes.co.il'),
  ('כלכליסט',       'osint',  'media',           'reported', 'https://www.calcalist.co.il'),
  ('TheMarker',     'osint',  'media',           'reported', 'https://www.themarker.com'),
  ('נתוני שוק',     'finint', 'market_data',     'verified', null),
  ('SEC EDGAR',     'osint',  'official_report', 'verified', 'https://www.sec.gov'),
  ('דמודרן',        'osint',  'research',        'reported', 'https://pages.stern.nyu.edu/~adamodar')
on conflict (name) do nothing;

insert into feature_flags (key, enabled, premium_only, description) values
  ('engine_insider',  true,  true,  'מעקב בעלי עניין — פרימיום'),
  ('engine_calendar', true,  false, 'לוח אירועים'),
  ('engine_brief',    false, true,  'בריף יומי אישי — פרימיום, רדום'),
  ('paywall',         false, false, 'חומת תשלום ראשית — רדומה')
on conflict (key) do nothing;
