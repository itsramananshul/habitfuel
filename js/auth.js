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

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  window.location.href = "/pages/auth.html";
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
