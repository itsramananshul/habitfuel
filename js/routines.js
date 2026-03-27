import { requireAuth } from "./auth.js";
import { supabaseClient } from "./config.js";
import { renderSidebar, showToast, openModal, todayStr } from "./ui.js";

let currentUser = null;
let routinesData = [];
let completionsToday = new Set();

export async function initRoutines() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  renderSidebar();
  await loadRoutines();
  renderWeekGrid();
}

// ── Load Data ───────────────────────────────────────────────
async function loadRoutines() {
  const today = todayStr();

  const { data: routines, error } = await supabaseClient
    .from("routines")
    .select("*, routine_tasks(*)")
    .eq("user_id", currentUser.id)
    .order("created_at");

  if (error) { showToast("Failed to load routines", "error"); return; }
  routinesData = routines || [];

  const { data: completions } = await supabaseClient
    .from("task_completions")
    .select("task_id")
    .eq("user_id", currentUser.id)
    .eq("date", today);

  completionsToday = new Set((completions || []).map(c => c.task_id));
  renderRoutineList();
}

// ── Render Task List for Today ──────────────────────────────
function renderRoutineList() {
  const container = document.getElementById("routines-list");
  if (!container) return;

  if (routinesData.length === 0) {
    container.innerHTML = `<div class="empty-state">No routines yet. Add one to get started!</div>`;
    return;
  }

  container.innerHTML = routinesData.map(routine => {
    const tasks = routine.routine_tasks || [];
    const doneCount = tasks.filter(t => completionsToday.has(t.id)).length;
    const ratio = tasks.length ? doneCount / tasks.length : 0;
    const statusCls = ratio === 0 ? "status-none" : ratio < 1 ? "status-partial" : "status-complete";

    return `
      <div class="routine-card ${statusCls}" data-routine-id="${routine.id}">
        <div class="routine-card-header">
          <h3 class="routine-name">${routine.name}</h3>
          <div class="routine-meta">
            <span class="task-count">${doneCount}/${tasks.length} done</span>
            <button class="btn-icon" data-action="edit-routine" data-id="${routine.id}" title="Edit">✎</button>
            <button class="btn-icon btn-danger" data-action="delete-routine" data-id="${routine.id}" title="Delete">✕</button>
          </div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${Math.round(ratio*100)}%"></div>
        </div>
        <ul class="task-list">
          ${tasks.map(task => `
            <li class="task-item ${completionsToday.has(task.id) ? "task-done" : ""}"
                data-task-id="${task.id}" data-routine-id="${routine.id}">
              <span class="task-check">${completionsToday.has(task.id) ? "✓" : "○"}</span>
              <span class="task-name">${task.name}</span>
              <button class="btn-icon btn-danger task-delete" data-action="delete-task" data-task-id="${task.id}">✕</button>
            </li>
          `).join("")}
        </ul>
        <button class="btn-ghost btn-sm" data-action="add-task" data-routine-id="${routine.id}">+ Add task</button>
      </div>
    `;
  }).join("");

  attachRoutineEvents(container);
}

function attachRoutineEvents(container) {
  container.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    const taskItem = e.target.closest(".task-item");

    // Toggle task completion
    if (taskItem && !e.target.closest("[data-action]")) {
      await toggleTask(taskItem.dataset.taskId, taskItem.dataset.routineId);
      return;
    }

    if (action === "edit-routine") openEditRoutineModal(e.target.closest("[data-id]").dataset.id);
    if (action === "delete-routine") deleteRoutine(e.target.closest("[data-id]").dataset.id);
    if (action === "add-task") openAddTaskModal(e.target.closest("[data-routine-id]").dataset.routineId);
    if (action === "delete-task") deleteTask(e.target.closest("[data-task-id]").dataset.taskId);
  });
}

async function toggleTask(taskId, routineId) {
  const today = todayStr();
  if (completionsToday.has(taskId)) {
    await supabaseClient.from("task_completions")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("task_id", taskId)
      .eq("date", today);
    completionsToday.delete(taskId);
  } else {
    await supabaseClient.from("task_completions")
      .insert({ user_id: currentUser.id, task_id: taskId, date: today });
    completionsToday.add(taskId);
  }
  renderRoutineList();
  renderWeekGrid();
}

// ── Week Grid (7-day overview) ──────────────────────────────
async function renderWeekGrid() {
  const grid = document.getElementById("week-grid");
  if (!grid) return;

  const days = 7;
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const { data: completions } = await supabaseClient
    .from("task_completions")
    .select("date, task_id")
    .eq("user_id", currentUser.id)
    .gte("date", dates[0]);

  const allTasks = routinesData.flatMap(r => r.routine_tasks || []);
  const totalTasks = allTasks.length;

  const byDate = {};
  (completions || []).forEach(c => { byDate[c.date] = (byDate[c.date] || 0) + 1; });

  grid.innerHTML = dates.map((date, i) => {
    const done  = byDate[date] || 0;
    const ratio = totalTasks ? done / totalTasks : 0;
    const isToday = date === todayStr();
    const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
    const dayNum = new Date(date + "T00:00:00").getDate();

    const colorCls = ratio === 0 ? "day-empty" : ratio < 1 ? "day-partial" : "day-complete";

    return `
      <div class="day-cell ${colorCls} ${isToday ? "day-today" : ""}">
        <div class="day-label">${label}</div>
        <div class="day-num">${dayNum}</div>
        <div class="day-count">${done}/${totalTasks}</div>
      </div>
    `;
  }).join("");
}

// ── Add Routine Modal ───────────────────────────────────────
export function openAddRoutineModal() {
  const { overlay, close } = openModal(`
    <h2 class="modal-title">New Routine</h2>
    <div class="form-group">
      <label>Routine Name</label>
      <input type="text" id="modal-routine-name" class="form-input" placeholder="e.g. Morning Routine" />
    </div>
    <button class="btn-primary" id="modal-save-routine">Create Routine</button>
  `);

  overlay.querySelector("#modal-save-routine").addEventListener("click", async () => {
    const name = overlay.querySelector("#modal-routine-name").value.trim();
    if (!name) { showToast("Enter a routine name", "warning"); return; }

    const { error } = await supabaseClient.from("routines")
      .insert({ user_id: currentUser.id, name });

    if (error) { showToast("Failed to create routine", "error"); return; }
    showToast("Routine created!", "success");
    close();
    await loadRoutines();
  });
}

function openAddTaskModal(routineId) {
  const { overlay, close } = openModal(`
    <h2 class="modal-title">Add Task</h2>
    <div class="form-group">
      <label>Task Name</label>
      <input type="text" id="modal-task-name" class="form-input" placeholder="e.g. Drink water" />
    </div>
    <button class="btn-primary" id="modal-save-task">Add Task</button>
  `);

  overlay.querySelector("#modal-save-task").addEventListener("click", async () => {
    const name = overlay.querySelector("#modal-task-name").value.trim();
    if (!name) { showToast("Enter a task name", "warning"); return; }

    const { error } = await supabaseClient.from("routine_tasks")
      .insert({ routine_id: routineId, name });

    if (error) { showToast("Failed to add task", "error"); return; }
    showToast("Task added!", "success");
    close();
    await loadRoutines();
  });
}

function openEditRoutineModal(routineId) {
  const routine = routinesData.find(r => r.id == routineId);
  if (!routine) return;

  const { overlay, close } = openModal(`
    <h2 class="modal-title">Edit Routine</h2>
    <div class="form-group">
      <label>Routine Name</label>
      <input type="text" id="modal-edit-name" class="form-input" value="${routine.name}" />
    </div>
    <button class="btn-primary" id="modal-update-routine">Update</button>
  `);

  overlay.querySelector("#modal-update-routine").addEventListener("click", async () => {
    const name = overlay.querySelector("#modal-edit-name").value.trim();
    if (!name) return;

    await supabaseClient.from("routines").update({ name }).eq("id", routineId);
    showToast("Routine updated!", "success");
    close();
    await loadRoutines();
  });
}

async function deleteRoutine(routineId) {
  if (!confirm("Delete this routine and all its tasks?")) return;
  await supabaseClient.from("routines").delete().eq("id", routineId);
  showToast("Routine deleted", "info");
  await loadRoutines();
}

async function deleteTask(taskId) {
  if (!confirm("Delete this task?")) return;
  await supabaseClient.from("routine_tasks").delete().eq("id", taskId);
  showToast("Task deleted", "info");
  await loadRoutines();
}
