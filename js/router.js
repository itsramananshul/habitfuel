import { getUser } from "./auth.js";

// ── Simple Client-Side Router ───────────────────────────────
const routes = {
  "/": "/pages/dashboard.html",
  "/dashboard": "/pages/dashboard.html",
  "/routines": "/pages/routines.html",
  "/calories": "/pages/calories.html",
  "/goals": "/pages/goals.html",
  "/reports": "/pages/reports.html",
  "/feedback": "/pages/feedback.html",
  "/auth": "/pages/auth.html",
};

const publicRoutes = ["/auth", "/pages/auth.html"];

export async function navigate(path) {
  const user = await getUser();
  const isPublic = publicRoutes.some(r => path.includes(r));

  if (!user && !isPublic) {
    window.location.href = "/pages/auth.html";
    return;
  }

  if (user && isPublic) {
    window.location.href = "/pages/dashboard.html";
    return;
  }

  window.location.href = path;
}

export function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes("dashboard")) return "dashboard";
  if (path.includes("routines")) return "routines";
  if (path.includes("calories")) return "calories";
  if (path.includes("goals")) return "goals";
  if (path.includes("reports")) return "reports";
  if (path.includes("feedback")) return "feedback";
  return "dashboard";
}
