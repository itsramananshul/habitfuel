# HabitFuel 🔥

A free, unified habit tracker + calorie tracker. No subscriptions, no BS.

---

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JS (ES Modules) — multi-file structure
- **Database & Auth**: Supabase (Postgres + Row Level Security)
- **Nutrition APIs**: USDA FoodData Central → Open Food Facts (fallback chain)
- **Hosting**: Vercel

---

## Setup Guide

### Step 1 — Supabase

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub
2. Click **New Project** → name it `habitfuel`, pick a region, set a DB password
3. Wait ~2 minutes for it to provision
4. Go to **Project Settings → API** and copy:
   - **Project URL** → paste into `js/config.js` as `SUPABASE_URL`
   - **anon public key** → paste into `js/config.js` as `SUPABASE_ANON_KEY`
5. Go to **SQL Editor → New Query**, paste the entire contents of `supabase-schema.sql`, and click **Run**
6. Go to **Authentication → Providers** → confirm **Email** is enabled

### Step 2 — USDA API Key (free)

1. Go to [https://fdc.nal.usda.gov/api-guide.html](https://fdc.nal.usda.gov/api-guide.html)
2. Click **Get an API Key** — fill out the short form, it's instant and free
3. Paste your key into `js/nutrition.js` as `USDA_API_KEY`
   - Note: `DEMO_KEY` works but is rate-limited (1000 requests/hour per IP)

### Step 3 — Vercel Deployment

1. Push this project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Leave all build settings as default (no build step needed — it's static)
4. Click **Deploy** — done!

---

## File Structure

```
habitfuel/
├── index.html              ← Landing page + auto-redirect
├── vercel.json             ← Vercel routing config
├── supabase-schema.sql     ← Run this once in Supabase SQL Editor
├── css/
│   ├── main.css            ← Design system, variables, layout, utilities
│   ├── auth.css            ← Auth page styles
│   ├── dashboard.css       ← Dashboard-specific styles
│   ├── routines.css        ← Habit grid and task cards
│   ├── calories.css        ← Calorie tracker styles
│   └── components.css      ← Sidebar, toasts, modals, tabs
├── js/
│   ├── config.js           ← Supabase URL + anon key (edit this!)
│   ├── auth.js             ← signIn, signUp, signOut, requireAuth
│   ├── router.js           ← Page navigation helpers
│   ├── ui.js               ← Sidebar, toasts, modals, shared utils
│   ├── nutrition.js        ← USDA + Open Food Facts fetch chain
│   ├── dashboard.js        ← Dashboard stats + heatmap
│   ├── routines.js         ← Habit tracking, task toggling
│   ├── calories.js         ← Manual + auto calorie logging
│   ├── goals.js            ← User goal management
│   ├── reports.js          ← Monthly insights + suggestions
│   └── feedback.js         ← Feedback form submission
└── pages/
    ├── auth.html
    ├── dashboard.html
    ├── routines.html
    ├── calories.html
    ├── goals.html
    ├── reports.html
    └── feedback.html
```

---

## Features (MVP)

- ✅ Email/password auth via Supabase
- ✅ Daily habit tracking with color-coded grid (empty → partial → complete)
- ✅ 7-day week overview + 30-day heatmap
- ✅ Manual calorie + macro logging
- ✅ Auto nutrition fetch: USDA → Open Food Facts fallback
- ✅ Cooked vs. raw distinction with calorie adjustment
- ✅ Goal setting (bulk / cut / maintain / productivity)
- ✅ Monthly reports with habit + nutrition insights
- ✅ Personalized improvement suggestions
- ✅ Feedback form stored in DB
- ✅ Collapsible sidebar navigation
- ✅ Toast notifications + modal system

## Roadmap (future iterations)

- [ ] Admin panel for feedback + user activity
- [ ] Barcode scanning via Open Food Facts
- [ ] Custom routine scheduling (not just daily)
- [ ] Weight tracking chart
- [ ] PWA / mobile app (add to home screen)
- [ ] Export data as CSV
