import { requireAuth } from "./auth.js";
import { supabaseClient } from "./config.js";
import { renderSidebar, showToast, todayStr } from "./ui.js";

export async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;

  renderSidebar();
  await loadDashboard(user.id);
}

async function loadDashboard(userId) {
  const today = todayStr();

  // Load today's calories
  const { data: calorieEntries } = await supabaseClient
    .from("calorie_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today);

  const totalCals  = (calorieEntries || []).reduce((s, e) => s + (e.calories || 0), 0);
  const totalProt  = (calorieEntries || []).reduce((s, e) => s + (e.protein  || 0), 0);

  // Load user goal
  const { data: goal } = await supabaseClient
    .from("user_goals")
    .select("*")
    .eq("user_id", userId)
    .single();

  const calGoal  = goal?.calorie_goal  || 2000;
  const protGoal = goal?.protein_goal  || 150;

  // Load routines for today
  const { data: routines } = await supabaseClient
    .from("routines")
    .select("*, routine_tasks(*)")
    .eq("user_id", userId);

  const { data: completions } = await supabaseClient
    .from("task_completions")
    .select("task_id")
    .eq("user_id", userId)
    .eq("date", today);

  const completedIds = new Set((completions || []).map(c => c.task_id));
  const allTasks = (routines || []).flatMap(r => r.routine_tasks || []);
  const doneCount = allTasks.filter(t => completedIds.has(t.id)).length;
  const totalTasks = allTasks.length;

  // Render stats
  document.getElementById("stat-calories").textContent  = `${totalCals} / ${calGoal}`;
  document.getElementById("stat-protein").textContent   = `${totalProt.toFixed(1)}g / ${protGoal}g`;
  document.getElementById("stat-tasks").textContent     = `${doneCount} / ${totalTasks}`;
  document.getElementById("stat-date").textContent      = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Progress bars
  setBar("bar-calories", totalCals, calGoal);
  setBar("bar-protein",  totalProt, protGoal);
  setBar("bar-tasks",    doneCount, totalTasks || 1);

  // Heatmap (last 30 days)
  await renderHeatmap(userId);
}

function setBar(id, value, max) {
  const el = document.getElementById(id);
  if (!el) return;
  const pct = Math.min(100, Math.round((value / max) * 100));
  el.style.width = pct + "%";
  el.setAttribute("aria-valuenow", pct);
}

async function renderHeatmap(userId) {
  const heatmapEl = document.getElementById("heatmap");
  if (!heatmapEl) return;

  const days = 30;
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const { data: completions } = await supabaseClient
    .from("task_completions")
    .select("date, task_id")
    .eq("user_id", userId)
    .gte("date", dates[0]);

  const { data: routines } = await supabaseClient
    .from("routines")
    .select("*, routine_tasks(*)")
    .eq("user_id", userId);

  const totalTasks = (routines || []).flatMap(r => r.routine_tasks || []).length;
  const byDate = {};
  (completions || []).forEach(c => {
    byDate[c.date] = (byDate[c.date] || 0) + 1;
  });

  heatmapEl.innerHTML = dates.map(date => {
    const done  = byDate[date] || 0;
    const ratio = totalTasks ? done / totalTasks : 0;
    const cls   = ratio === 0 ? "heat-0" : ratio < 0.5 ? "heat-1" : ratio < 1 ? "heat-2" : "heat-3";
    const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<div class="heat-cell ${cls}" title="${label}: ${done}/${totalTasks} tasks"></div>`;
  }).join("");
}
