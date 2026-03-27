-- ============================================================
-- HabitFuel — Supabase Database Schema
-- Paste this entire file into: Supabase > SQL Editor > New Query
-- Then click RUN
-- ============================================================

-- Enable RLS (Row Level Security) — users only see their own data

-- ── Routines ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routines (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routines" ON routines
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Routine Tasks ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routine_tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id  UUID REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE routine_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks" ON routine_tasks
  USING (
    EXISTS (
      SELECT 1 FROM routines r
      WHERE r.id = routine_tasks.routine_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routines r
      WHERE r.id = routine_tasks.routine_id AND r.user_id = auth.uid()
    )
  );

-- ── Task Completions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_completions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id     UUID REFERENCES routine_tasks(id) ON DELETE CASCADE NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_id, date)
);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own completions" ON task_completions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Calorie Entries ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calorie_entries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  food_name     TEXT NOT NULL,
  cooking_type  TEXT DEFAULT 'na',   -- 'raw', 'cooked', 'na'
  weight_g      NUMERIC,
  calories      NUMERIC NOT NULL DEFAULT 0,
  protein       NUMERIC DEFAULT 0,
  carbs         NUMERIC DEFAULT 0,
  fat           NUMERIC DEFAULT 0,
  source        TEXT DEFAULT 'manual',  -- 'manual', 'USDA', 'Open Food Facts'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calorie_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calorie entries" ON calorie_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── User Goals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_goals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  goal_type     TEXT DEFAULT 'maintain',   -- 'bulk', 'cut', 'maintain', 'productivity'
  calorie_goal  INTEGER DEFAULT 2000,
  protein_goal  INTEGER DEFAULT 150,
  carbs_goal    INTEGER DEFAULT 250,
  fat_goal      INTEGER DEFAULT 65,
  notes         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals" ON user_goals
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Feedback ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT,
  type        TEXT DEFAULT 'general',   -- 'bug', 'feature', 'general', 'other'
  subject     TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can insert feedback; only they can view their own
CREATE POLICY "Users can submit feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

-- ── Indexes for performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_task_completions_user_date ON task_completions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calorie_entries_user_date  ON calorie_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_routine_tasks_routine      ON routine_tasks(routine_id);
