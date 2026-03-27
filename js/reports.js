import { requireAuth } from "./auth.js";
import { supabaseClient } from "./config.js";
import { renderSidebar, showToast } from "./ui.js";

export async function initReports() {
  const user = await requireAuth();
  if (!user) return;

  renderSidebar();
  await generateReport(user.id);
}

async function generateReport(userId) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate   = new Date(year, month + 1, 0).toISOString().split("T")[0];

  // Fetch data
  const [routinesRes, completionsRes, caloriesRes, goalRes] = await Promise.all([
    supabaseClient.from("routines").select("*, routine_tasks(*)").eq("user_id", userId),
    supabaseClient.from("task_completions").select("*").eq("user_id", userId).gte("date", startDate).lte("date", endDate),
    supabaseClient.from("calorie_entries").select("*").eq("user_id", userId).gte("date", startDate).lte("date", endDate),
    supabaseClient.from("user_goals").select("*").eq("user_id", userId).single(),
  ]);

  const routines    = routinesRes.data  || [];
  const completions = completionsRes.data || [];
  const entries     = caloriesRes.data  || [];
  const goal        = goalRes.data;

  const allTasks   = routines.flatMap(r => r.routine_tasks || []);
  const totalTasks = allTasks.length;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Habit stats
  const byDate = {};
  completions.forEach(c => { byDate[c.date] = (byDate[c.date] || 0) + 1; });
  const activeDays    = Object.keys(byDate).length;
  const perfectDays   = Object.values(byDate).filter(v => v >= totalTasks).length;
  const avgCompletion = activeDays ? (Object.values(byDate).reduce((a,b) => a+b, 0) / activeDays / (totalTasks||1) * 100).toFixed(0) : 0;

  // Task streaks - find most/least completed tasks
  const taskCounts = {};
  completions.forEach(c => { taskCounts[c.task_id] = (taskCounts[c.task_id] || 0) + 1; });
  const tasksSorted = allTasks.sort((a,b) => (taskCounts[b.id]||0) - (taskCounts[a.id]||0));
  const topTask    = tasksSorted[0];
  const bottomTask = tasksSorted[tasksSorted.length-1];

  // Calorie stats
  const calGoal = goal?.calorie_goal || 2000;
  const protGoal = goal?.protein_goal || 150;
  const byDateCal = {};
  entries.forEach(e => {
    if (!byDateCal[e.date]) byDateCal[e.date] = { cal:0, prot:0, count:0 };
    byDateCal[e.date].cal  += e.calories || 0;
    byDateCal[e.date].prot += e.protein  || 0;
    byDateCal[e.date].count++;
  });

  const calDays   = Object.values(byDateCal);
  const avgCal    = calDays.length ? Math.round(calDays.reduce((s,d) => s+d.cal, 0) / calDays.length) : 0;
  const avgProt   = calDays.length ? (calDays.reduce((s,d) => s+d.prot, 0) / calDays.length).toFixed(1) : 0;
  const overCal   = calDays.filter(d => d.cal > calGoal * 1.1).length;
  const underProt = calDays.filter(d => d.prot < protGoal * 0.8).length;

  // Render report
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  document.getElementById("report-title").textContent = `${monthName} Report`;

  renderInsight("insight-habits", [
    `You tracked habits on <strong>${activeDays}</strong> of ${daysInMonth} days this month.`,
    `<strong>${perfectDays}</strong> perfect days (all tasks completed).`,
    `Average daily task completion: <strong>${avgCompletion}%</strong>.`,
    topTask    ? `Most consistent habit: <strong>${topTask.name}</strong> (${taskCounts[topTask.id]||0} times).` : "",
    bottomTask ? `Needs improvement: <strong>${bottomTask.name}</strong> (${taskCounts[bottomTask.id]||0} times).` : "",
  ].filter(Boolean));

  renderInsight("insight-nutrition", [
    `Average daily calories: <strong>${avgCal}</strong> kcal (goal: ${calGoal}).`,
    `Average daily protein: <strong>${avgProt}g</strong> (goal: ${protGoal}g).`,
    overCal   ? `⚠ You exceeded your calorie target by >10% on <strong>${overCal}</strong> days.` : "✓ Good calorie control this month!",
    underProt ? `⚠ Protein was under 80% of goal on <strong>${underProt}</strong> days — consider higher-protein meals.` : "✓ Solid protein intake this month!",
  ]);

  renderInsight("insight-suggestions", generateSuggestions({ avgCompletion, perfectDays, underProt, overCal, avgCal, calGoal, avgProt, protGoal, activeDays, daysInMonth }));

  renderMonthHeatmap(userId, startDate, endDate, totalTasks);
}

function generateSuggestions({ avgCompletion, perfectDays, underProt, overCal, avgCal, calGoal, activeDays, daysInMonth }) {
  const suggestions = [];
  if (avgCompletion < 50) suggestions.push("Try reducing the number of habits — fewer, consistent ones beat many sporadic ones.");
  if (perfectDays < 5)   suggestions.push("Set a reminder at a fixed time each day to check off your habits.");
  if (underProt > 7)     suggestions.push("Add a protein-rich snack (Greek yogurt, eggs, cottage cheese) to boost your daily intake.");
  if (overCal > 7)       suggestions.push("Log your calories earlier in the day to avoid overshooting at dinner.");
  if (activeDays < daysInMonth * 0.5) suggestions.push("You missed tracking on many days. Even partial logging helps build the habit.");
  if (suggestions.length === 0) suggestions.push("Great month! Keep the momentum going. 🎯");
  return suggestions;
}

function renderInsight(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<ul class="insight-list">${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
}

async function renderMonthHeatmap(userId, startDate, endDate, totalTasks) {
  const heatmap = document.getElementById("report-heatmap");
  if (!heatmap) return;

  const { data: completions } = await supabaseClient
    .from("task_completions").select("date, task_id")
    .eq("user_id", userId).gte("date", startDate).lte("date", endDate);

  const byDate = {};
  (completions || []).forEach(c => { byDate[c.date] = (byDate[c.date] || 0) + 1; });

  const start = new Date(startDate + "T00:00:00");
  const end   = new Date(endDate   + "T00:00:00");
  const cells = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const done    = byDate[dateStr] || 0;
    const ratio   = totalTasks ? done / totalTasks : 0;
    const cls     = ratio === 0 ? "heat-0" : ratio < 0.5 ? "heat-1" : ratio < 1 ? "heat-2" : "heat-3";
    const label   = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    cells.push(`<div class="heat-cell ${cls}" title="${label}: ${done}/${totalTasks}"></div>`);
  }

  heatmap.innerHTML = cells.join("");
}
