import { requireAuth } from "./auth.js";
import { supabaseClient } from "./config.js";
import { renderSidebar, showToast, openModal } from "./ui.js";

let currentUserId = null;

export async function initGoals() {
  const user = await requireAuth();
  if (!user) return;

  currentUserId = user.id;
  renderSidebar();
  await loadGoals(user.id);
  await loadCustomGoals(user.id);

  document.getElementById("save-goals")?.addEventListener("click", () => saveGoals(user.id));
  document.getElementById("add-custom-goal-btn")?.addEventListener("click", openAddCustomGoalModal);
}

// ── Nutrition Goals (existing) ──────────────────────────────
async function loadGoals(userId) {
  const { data: goal } = await supabaseClient
    .from("user_goals").select("*").eq("user_id", userId).single();

  if (!goal) return;

  document.getElementById("goal-type").value    = goal.goal_type    || "maintain";
  document.getElementById("calorie-goal").value = goal.calorie_goal || 2000;
  document.getElementById("protein-goal").value = goal.protein_goal || 150;
  document.getElementById("carbs-goal").value   = goal.carbs_goal   || 250;
  document.getElementById("fat-goal").value     = goal.fat_goal     || 65;
  document.getElementById("goal-notes").value   = goal.notes        || "";
}

async function saveGoals(userId) {
  const payload = {
    user_id:      userId,
    goal_type:    document.getElementById("goal-type").value,
    calorie_goal: parseInt(document.getElementById("calorie-goal").value) || 2000,
    protein_goal: parseInt(document.getElementById("protein-goal").value) || 150,
    carbs_goal:   parseInt(document.getElementById("carbs-goal").value)   || 250,
    fat_goal:     parseInt(document.getElementById("fat-goal").value)     || 65,
    notes:        document.getElementById("goal-notes").value,
  };

  const { error } = await supabaseClient
    .from("user_goals")
    .upsert(payload, { onConflict: "user_id" });

  if (error) { showToast("Failed to save goals", "error"); return; }
  showToast("Goals saved!", "success");
}

// ── Custom Goals ────────────────────────────────────────────
const CATEGORY_ICONS = {
  fitness:     "🏃",
  health:      "❤️",
  mindset:     "🧠",
  sleep:       "😴",
  hydration:   "💧",
  learning:    "📚",
  productivity:"⚡",
  finance:     "💰",
  social:      "🤝",
  other:       "🎯",
};

async function loadCustomGoals(userId) {
  const { data: goals, error } = await supabaseClient
    .from("custom_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    // Table might not exist yet — show a helpful SQL prompt
    renderCustomGoalsEmpty(true);
    return;
  }

  renderCustomGoals(goals || []);
}

function renderCustomGoals(goals) {
  const container = document.getElementById("custom-goals-list");
  if (!container) return;

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1.5rem 0;text-align:center;color:var(--text-3);">
        No custom goals yet. Add one to start tracking anything you care about!
      </div>`;
    return;
  }

  container.innerHTML = goals.map(g => {
    const icon = CATEGORY_ICONS[g.category] || "🎯";
    const pct  = g.target_value ? Math.min(100, Math.round((g.current_value || 0) / g.target_value * 100)) : 0;
    const done = g.target_value && (g.current_value || 0) >= g.target_value;

    return `
      <div class="custom-goal-card ${done ? "goal-done" : ""}" data-id="${g.id}">
        <div class="cg-header">
          <div class="cg-icon-title">
            <span class="cg-icon">${icon}</span>
            <div>
              <div class="cg-title">${g.title}</div>
              <div class="cg-category">${g.category || "other"}</div>
            </div>
          </div>
          <div class="cg-actions">
            <button class="btn-icon" data-action="edit-cg" data-id="${g.id}" title="Edit">✎</button>
            <button class="btn-icon btn-danger" data-action="delete-cg" data-id="${g.id}" title="Delete">✕</button>
          </div>
        </div>

        ${g.description ? `<div class="cg-desc">${g.description}</div>` : ""}

        <div class="cg-progress-row">
          <div class="cg-numbers">
            <span class="cg-current">${g.current_value ?? 0}</span>
            ${g.target_value ? `<span class="cg-sep"> / </span><span class="cg-target">${g.target_value}</span>` : ""}
            ${g.unit ? `<span class="cg-unit"> ${g.unit}</span>` : ""}
          </div>
          ${done ? `<span class="cg-badge">✓ Done</span>` : ""}
        </div>

        ${g.target_value ? `
          <div class="progress-bar-wrap" style="margin-top:0.5rem;">
            <div class="progress-bar-fill ${done ? "bar-done" : ""}" style="width:${pct}%"></div>
          </div>
          <div class="cg-pct">${pct}%</div>
        ` : ""}

        <div class="cg-footer">
          ${g.deadline ? `<span class="cg-deadline">📅 Due ${formatDeadline(g.deadline)}</span>` : ""}
          <div class="cg-log-row">
            <input type="number" class="form-input cg-log-input" placeholder="Log progress" step="any" data-id="${g.id}" />
            <button class="btn-ghost btn-sm" data-action="log-cg" data-id="${g.id}">+ Log</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  attachCustomGoalEvents(container);
}

function renderCustomGoalsEmpty(tablesMissing = false) {
  const container = document.getElementById("custom-goals-list");
  if (!container) return;
  if (tablesMissing) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1rem 0;color:var(--text-3);font-size:0.85rem;">
        ⚠ Run the SQL below in your Supabase SQL editor to enable custom goals, then refresh.<br><br>
        <code style="display:block;background:var(--surface-2);padding:0.75rem;border-radius:6px;font-size:0.78rem;white-space:pre-wrap;">CREATE TABLE IF NOT EXISTS custom_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'other',
  unit text,
  target_value numeric,
  current_value numeric DEFAULT 0,
  deadline date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE custom_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own custom goals"
  ON custom_goals FOR ALL USING (auth.uid() = user_id);</code>
      </div>`;
  }
}

function attachCustomGoalEvents(container) {
  container.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!action || !id) return;

    if (action === "delete-cg") {
      if (!confirm("Delete this goal?")) return;
      await supabaseClient.from("custom_goals").delete().eq("id", id);
      showToast("Goal deleted", "info");
      await loadCustomGoals(currentUserId);
    }

    if (action === "edit-cg") {
      const { data: goal } = await supabaseClient.from("custom_goals").select("*").eq("id", id).single();
      if (goal) openEditCustomGoalModal(goal);
    }

    if (action === "log-cg") {
      const input = container.querySelector(`.cg-log-input[data-id="${id}"]`);
      const value = parseFloat(input?.value);
      if (isNaN(value)) { showToast("Enter a valid number to log", "warning"); return; }

      const { data: goal } = await supabaseClient.from("custom_goals").select("current_value").eq("id", id).single();
      const newValue = (goal?.current_value || 0) + value;

      await supabaseClient.from("custom_goals").update({ current_value: newValue }).eq("id", id);
      showToast(`Logged +${value}!`, "success");
      if (input) input.value = "";
      await loadCustomGoals(currentUserId);
    }
  });
}

// ── Add Custom Goal Modal ───────────────────────────────────
function openAddCustomGoalModal() {
  const { overlay, close } = openModal(`
    <h2 class="modal-title">New Custom Goal</h2>
    ${customGoalForm()}
    <button class="btn-primary" id="modal-save-cg" style="width:100%;margin-top:0.25rem;">Create Goal</button>
  `);

  overlay.querySelector("#modal-save-cg").addEventListener("click", async () => {
    const data = readCustomGoalForm(overlay);
    if (!data) return;

    const { error } = await supabaseClient.from("custom_goals").insert({ user_id: currentUserId, ...data });
    if (error) { showToast("Failed to create goal", "error"); return; }
    showToast("Goal created!", "success");
    close();
    await loadCustomGoals(currentUserId);
  });
}

function openEditCustomGoalModal(goal) {
  const { overlay, close } = openModal(`
    <h2 class="modal-title">Edit Goal</h2>
    ${customGoalForm(goal)}
    <button class="btn-primary" id="modal-update-cg" style="width:100%;margin-top:0.25rem;">Save Changes</button>
  `);

  overlay.querySelector("#modal-update-cg").addEventListener("click", async () => {
    const data = readCustomGoalForm(overlay);
    if (!data) return;

    const { error } = await supabaseClient.from("custom_goals").update(data).eq("id", goal.id);
    if (error) { showToast("Failed to update goal", "error"); return; }
    showToast("Goal updated!", "success");
    close();
    await loadCustomGoals(currentUserId);
  });
}

function customGoalForm(g = {}) {
  const cats = Object.entries(CATEGORY_ICONS).map(([k, v]) =>
    `<option value="${k}" ${g.category === k ? "selected" : ""}>${v} ${k.charAt(0).toUpperCase() + k.slice(1)}</option>`
  ).join("");

  return `
    <div class="form-group">
      <label>Goal Title *</label>
      <input type="text" id="cg-title" class="form-input" placeholder="e.g. Run 5km, Read 20 pages, Drink 3L water" value="${g.title || ""}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Category</label>
        <select id="cg-category" class="form-select">${cats}</select>
      </div>
      <div class="form-group">
        <label>Unit (optional)</label>
        <input type="text" id="cg-unit" class="form-input" placeholder="km, pages, hours…" value="${g.unit || ""}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Target Value (optional)</label>
        <input type="number" id="cg-target" class="form-input" placeholder="e.g. 100" step="any" value="${g.target_value ?? ""}" />
      </div>
      <div class="form-group">
        <label>Current Progress</label>
        <input type="number" id="cg-current" class="form-input" placeholder="0" step="any" value="${g.current_value ?? 0}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Deadline (optional)</label>
        <input type="date" id="cg-deadline" class="form-input" value="${g.deadline || ""}" />
      </div>
      <div class="form-group"></div>
    </div>
    <div class="form-group">
      <label>Description (optional)</label>
      <textarea id="cg-description" class="form-textarea" placeholder="Why does this goal matter to you?" style="min-height:80px;">${g.description || ""}</textarea>
    </div>
  `;
}

function readCustomGoalForm(overlay) {
  const title = overlay.querySelector("#cg-title").value.trim();
  if (!title) { showToast("Goal title is required", "warning"); return null; }

  return {
    title,
    category:      overlay.querySelector("#cg-category").value || "other",
    unit:          overlay.querySelector("#cg-unit").value.trim() || null,
    target_value:  parseFloat(overlay.querySelector("#cg-target").value) || null,
    current_value: parseFloat(overlay.querySelector("#cg-current").value) || 0,
    deadline:      overlay.querySelector("#cg-deadline").value || null,
    description:   overlay.querySelector("#cg-description").value.trim() || null,
  };
}

function formatDeadline(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0)  return `${Math.abs(diff)}d ago`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 30) return `in ${diff}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
