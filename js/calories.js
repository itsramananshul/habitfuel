import { requireAuth } from "./auth.js";
import { supabaseClient } from "./config.js";
import { renderSidebar, showToast, openModal, todayStr, setLoading } from "./ui.js";
import { fetchNutrition } from "./nutrition.js";

let currentUser = null;

export async function initCalories() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  renderSidebar();
  await loadTodayEntries();
  setupTabs();
}

// ── Tabs: Manual vs Auto ────────────────────────────────────
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.panel).classList.add("active");
    });
  });

  // Manual form submit
  document.getElementById("manual-save")?.addEventListener("click", saveManualEntry);

  // Auto form submit
  document.getElementById("auto-fetch")?.addEventListener("click", autoFetchEntry);
  document.getElementById("auto-save")?.addEventListener("click", saveAutoEntry);
}

// ── Manual Entry ────────────────────────────────────────────
async function saveManualEntry() {
  const foodName   = document.getElementById("m-food").value.trim();
  const cooking    = document.getElementById("m-cooking").value;
  const weight     = parseFloat(document.getElementById("m-weight").value);
  const calories   = parseFloat(document.getElementById("m-calories").value);
  const protein    = parseFloat(document.getElementById("m-protein").value) || 0;
  const carbs      = parseFloat(document.getElementById("m-carbs").value) || 0;
  const fat        = parseFloat(document.getElementById("m-fat").value) || 0;

  if (!foodName || isNaN(calories)) {
    showToast("Food name and calories are required", "warning"); return;
  }

  const { error } = await supabaseClient.from("calorie_entries").insert({
    user_id: currentUser.id, date: todayStr(),
    food_name: foodName, cooking_type: cooking,
    weight_g: weight || null, calories, protein, carbs, fat,
    source: "manual"
  });

  if (error) { showToast("Failed to save entry", "error"); return; }
  showToast("Entry saved!", "success");
  clearManualForm();
  await loadTodayEntries();
}

function clearManualForm() {
  ["m-food","m-weight","m-calories","m-protein","m-carbs","m-fat"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

// ── Auto Fetch Entry ────────────────────────────────────────
let fetchedNutrition = null;

async function autoFetchEntry() {
  const foodName = document.getElementById("a-food").value.trim();
  const cooking  = document.getElementById("a-cooking").value;
  const weight   = parseFloat(document.getElementById("a-weight").value);

  if (!foodName || isNaN(weight) || weight <= 0) {
    showToast("Food name and weight are required", "warning"); return;
  }

  const btn = document.getElementById("auto-fetch");
  setLoading(btn, true, "Fetching...");

  try {
    const result = await fetchNutrition(foodName, weight, cooking);
    fetchedNutrition = result;

    document.getElementById("auto-result").classList.remove("hidden");
    document.getElementById("r-food").textContent     = result.foodName;
    document.getElementById("r-calories").textContent = result.calories;
    document.getElementById("r-protein").textContent  = result.protein + "g";
    document.getElementById("r-carbs").textContent    = result.carbs + "g";
    document.getElementById("r-fat").textContent      = result.fat + "g";
    document.getElementById("r-source").textContent   = result.source;

    if (result.warning) {
      showToast(result.warning, "warning", 6000);
    }
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    setLoading(btn, false);
  }
}

async function saveAutoEntry() {
  if (!fetchedNutrition) return;
  const cooking = document.getElementById("a-cooking").value;
  const weight  = parseFloat(document.getElementById("a-weight").value);

  const { error } = await supabaseClient.from("calorie_entries").insert({
    user_id: currentUser.id, date: todayStr(),
    food_name: fetchedNutrition.foodName, cooking_type: cooking,
    weight_g: weight, calories: fetchedNutrition.calories,
    protein: fetchedNutrition.protein, carbs: fetchedNutrition.carbs,
    fat: fetchedNutrition.fat, source: fetchedNutrition.source
  });

  if (error) { showToast("Failed to save entry", "error"); return; }
  showToast("Entry saved!", "success");
  document.getElementById("auto-result").classList.add("hidden");
  fetchedNutrition = null;
  ["a-food","a-weight"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  await loadTodayEntries();
}

// ── Today's Log ─────────────────────────────────────────────
async function loadTodayEntries() {
  const today = todayStr();
  const { data: entries, error } = await supabaseClient
    .from("calorie_entries")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("date", today)
    .order("created_at", { ascending: false });

  if (error) return;

  const { data: goal } = await supabaseClient
    .from("user_goals").select("*").eq("user_id", currentUser.id).single();

  const calGoal  = goal?.calorie_goal  || 2000;
  const protGoal = goal?.protein_goal  || 150;

  const totalCal  = (entries || []).reduce((s, e) => s + (e.calories || 0), 0);
  const totalProt = (entries || []).reduce((s, e) => s + (e.protein  || 0), 0);
  const totalCarb = (entries || []).reduce((s, e) => s + (e.carbs    || 0), 0);
  const totalFat  = (entries || []).reduce((s, e) => s + (e.fat      || 0), 0);

  // Summary
  document.getElementById("total-calories").textContent = `${totalCal} / ${calGoal} kcal`;
  document.getElementById("total-protein").textContent  = `${totalProt.toFixed(1)} / ${protGoal}g`;
  document.getElementById("total-carbs").textContent    = totalCarb.toFixed(1) + "g";
  document.getElementById("total-fat").textContent      = totalFat.toFixed(1) + "g";

  const calPct  = Math.min(100, Math.round(totalCal  / calGoal  * 100));
  const protPct = Math.min(100, Math.round(totalProt / protGoal * 100));
  document.getElementById("cal-bar").style.width  = calPct  + "%";
  document.getElementById("prot-bar").style.width = protPct + "%";

  // Entry list
  const list = document.getElementById("entries-list");
  if (!list) return;
  if (!entries || entries.length === 0) {
    list.innerHTML = `<div class="empty-state">No entries today. Start logging!</div>`;
    return;
  }

  list.innerHTML = entries.map(e => `
    <div class="entry-row" data-id="${e.id}">
      <div class="entry-main">
        <span class="entry-food">${e.food_name}</span>
        <span class="entry-meta">${e.cooking_type !== "na" ? e.cooking_type : ""} ${e.weight_g ? e.weight_g + "g" : ""}</span>
      </div>
      <div class="entry-macros">
        <span class="macro cal">${e.calories} kcal</span>
        <span class="macro pro">P: ${e.protein || 0}g</span>
        <span class="macro car">C: ${e.carbs || 0}g</span>
        <span class="macro fat">F: ${e.fat || 0}g</span>
      </div>
      <button class="btn-icon btn-danger" data-action="delete-entry" data-id="${e.id}">✕</button>
    </div>
  `).join("");

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action='delete-entry']");
    if (btn) {
      await supabaseClient.from("calorie_entries").delete().eq("id", btn.dataset.id);
      showToast("Entry removed", "info");
      await loadTodayEntries();
    }
  });
}
