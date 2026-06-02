# 🕷️ NewFin

מערכת מודיעין פיננסי לשוק ההון — אוספת מידע ממגוון מקורות, מסננת לפי מהותיות, ומציגה תובנות ממוקדות לקבלת החלטות השקעה.

> **הקשר מלא:** ראה [`CLAUDE.md`](./CLAUDE.md) · **תוכנית בנייה:** ראה [`BLUEPRINT.md`](./BLUEPRINT.md)

## הרצה מקומית

```bash
npm install
npm run dev          # http://localhost:5173
```

עד שמחברים Supabase, האפליקציה רצה על נתוני דמו (`src/lib/mockData.ts`).

## חיבור Supabase

1. צור פרויקט חינמי ב-[supabase.com](https://supabase.com)
2. הרץ את `supabase/schema.sql` ואז `supabase/seed.sql` ב-SQL Editor
3. העתק URL + anon key אל `.env.local` (ראה `.env.example`)

## בדיקות

```bash
npm run typecheck    # בדיקת טיפוסים
npm run build        # build מלא
```

## פריסה

GitHub → Netlify (אוטומטי בכל push). תצורה ב-`netlify.toml`.

---

## Stack

React + TypeScript + Vite + Tailwind (RTL) · Supabase (DB + Auth + Edge Functions) · Netlify
