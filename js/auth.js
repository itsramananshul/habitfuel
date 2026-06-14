import { supabaseClient } from "./config.js";

// ── Auth State ──────────────────────────────────────────────
export async function getUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

export async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Owner sign-in via ATLAS (ARIA SSO) through Supabase Custom OIDC. Additive —
// email/password unchanged. max_age=10 forces a password prompt on every
// sign-in (per authentik authorize.py); prompt=login is best-effort.
export async function signInWithAtlas() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "custom:atlas",
    options: {
      scopes: "openid email profile",
      redirectTo: window.location.origin + "/pages/auth.html",
      queryParams: { prompt: "login", max_age: "10" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  // Only ATLAS-authenticated sessions end the ATLAS SSO session on logout;
  // regular email/password users just return to the login page.
  let viaAtlas = false;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const md = session?.user?.app_metadata || {};
    viaAtlas = [md.provider, ...(md.providers || [])].some((p) => String(p || "").includes("atlas"));
  } catch (e) {}
  try { await supabaseClient.auth.signOut(); } catch (e) {}
  if (viaAtlas) {
    window.location.href = "https://atlas.anshullabs.tech/application/o/habitfuel/end-session/";
  } else {
    window.location.href = "/pages/auth.html";
  }
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = "/pages/auth.html";
    return null;
  }
  return user;
}

export function onAuthStateChange(callback) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
