// ============================================================
// HabitFuel — Supabase Configuration
// ============================================================
// HOW TO SET UP SUPABASE:
//
// 1. Go to https://supabase.com and click "Start your project"
// 2. Sign in with GitHub (recommended) or email
// 3. Click "New project" — choose a name like "habitfuel"
// 4. Pick a region close to you, set a strong DB password, click Create
// 5. Wait ~2 minutes for the project to provision
// 6. Go to Project Settings → API
//    - Copy "Project URL"  → paste as SUPABASE_URL below
//    - Copy "anon public" key → paste as SUPABASE_ANON_KEY below
// 7. Go to SQL Editor → New query, paste and run the schema from README.md
// 8. Go to Authentication → Providers → make sure "Email" is enabled
//
// ============================================================

const SUPABASE_URL = "https://nqenenylhkvfyqjbqgzr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wBAKOI30U21g-R35NRy-2w_8kItJ5G9";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabaseClient };
