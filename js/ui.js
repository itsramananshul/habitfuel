import { signOut, getUser } from "./auth.js";
import { getCurrentPage } from "./router.js";

// ── Sidebar ─────────────────────────────────────────────────
export function renderSidebar(containerId = "sidebar") {
  const current = getCurrentPage();
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "⊞", href: "/pages/dashboard.html" },
    { id: "routines",  label: "Routines",  icon: "◎", href: "/pages/routines.html" },
    { id: "calories",  label: "Calories",  icon: "◑", href: "/pages/calories.html" },
    { id: "goals",     label: "Goals",     icon: "◈", href: "/pages/goals.html" },
    { id: "reports",   label: "Reports",   icon: "◧", href: "/pages/reports.html" },
    { id: "feedback",  label: "Feedback",  icon: "◻", href: "/pages/feedback.html" },
  ];

  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="sidebar" id="sidebarEl">
      <div class="sidebar-header">
        <span class="sidebar-logo">HF</span>
        <span class="sidebar-brand">HabitFuel</span>
        <button class="sidebar-toggle" id="sidebarToggle" title="Collapse">‹</button>
      </div>
      <nav class="sidebar-nav">
        ${nav.map(item => `
          <a href="${item.href}" class="sidebar-link ${current === item.id ? "active" : ""}">
            <span class="sidebar-icon">${item.icon}</span>
            <span class="sidebar-label">${item.label}</span>
          </a>
        `).join("")}
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-link" id="logoutBtn">
          <span class="sidebar-icon">↩</span>
          <span class="sidebar-label">Logout</span>
        </button>
      </div>
    </div>
  `;

  // Toggle collapse
  const sidebar = document.getElementById("sidebarEl");
  document.getElementById("sidebarToggle").addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    const t = document.getElementById("sidebarToggle");
    t.textContent = sidebar.classList.contains("collapsed") ? "›" : "‹";
  });

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut();
  });
}

// ── Toast Notifications ─────────────────────────────────────
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
}

export function showToast(message, type = "info", duration = 3500) {
  ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button class="toast-close">×</button>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  const remove = () => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector(".toast-close").addEventListener("click", remove);
  setTimeout(remove, duration);
}

// ── Modal ───────────────────────────────────────────────────
export function openModal(html, onClose = null) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <button class="modal-close-btn">×</button>
      <div class="modal-content">${html}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("modal-visible"));

  const close = () => {
    overlay.classList.remove("modal-visible");
    setTimeout(() => { overlay.remove(); if (onClose) onClose(); }, 300);
  };

  overlay.querySelector(".modal-close-btn").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  return { overlay, close };
}

// ── Loading Spinner ─────────────────────────────────────────
export function setLoading(el, isLoading, text = "") {
  if (isLoading) {
    el.disabled = true;
    el.dataset.originalText = el.textContent;
    el.innerHTML = `<span class="spinner"></span> ${text || "Loading..."}`;
  } else {
    el.disabled = false;
    el.textContent = el.dataset.originalText || el.textContent;
  }
}

// ── Format date helpers ─────────────────────────────────────
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}
