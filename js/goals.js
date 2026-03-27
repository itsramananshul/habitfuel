import { requireAuth } from "./auth.js";
import { supabaseClient } from "./config.js";
import { renderSidebar, showToast } from "./ui.js";

export async function initGoals() {
  const user = await requireAuth();
  if (!user) return;

  renderSidebar();
  await loadGoals(user.id);

  document.getElementById("save-goals")?.addEventListener("click", () => saveGoals(user.id));
}

async function loadGoals(userId) {
  const { data: goal } = await supabaseClient
    .from("user_goals").select("*").eq("user_id", userId).single();

  if (!goal) return;

  document.getElementById("goal-type").value        = goal.goal_type        || "maintain";
  document.getElementById("calorie-goal").value     = goal.calorie_goal     || 2000;
  document.getElementById("protein-goal").value     = goal.protein_goal     || 150;
  document.getElementById("carbs-goal").value       = goal.carbs_goal       || 250;
  document.getElementById("fat-goal").value         = goal.fat_goal         || 65;
  document.getElementById("goal-notes").value       = goal.notes            || "";
}

async function saveGoals(userId) {
  const payload = {
    user_id:       userId,
    goal_type:     document.getElementById("goal-type").value,
    calorie_goal:  parseInt(document.getElementById("calorie-goal").value) || 2000,
    protein_goal:  parseInt(document.getElementById("protein-goal").value) || 150,
    carbs_goal:    parseInt(document.getElementById("carbs-goal").value)   || 250,
    fat_goal:      parseInt(document.getElementById("fat-goal").value)     || 65,
    notes:         document.getElementById("goal-notes").value,
  };

  const { error } = await supabaseClient
    .from("user_goals")
    .upsert(payload, { onConflict: "user_id" });

  if (error) { showToast("Failed to save goals", "error"); return; }
  showToast("Goals saved!", "success");
}
