import { requireAuth } from "./auth.js";
import { supabaseClient } from "./config.js";
import { renderSidebar, showToast, setLoading } from "./ui.js";

export async function initFeedback() {
  const user = await requireAuth();
  if (!user) return;

  renderSidebar();

  document.getElementById("feedback-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("feedback-submit");
    setLoading(btn, true, "Sending...");

    const subject = document.getElementById("fb-subject").value.trim();
    const message = document.getElementById("fb-message").value.trim();
    const type    = document.getElementById("fb-type").value;

    if (!message) { showToast("Please enter a message", "warning"); setLoading(btn, false); return; }

    const { error } = await supabaseClient.from("feedback").insert({
      user_id: user.id,
      email:   user.email,
      subject, message, type
    });

    setLoading(btn, false);
    if (error) { showToast("Failed to send feedback", "error"); return; }
    showToast("Feedback sent — thank you!", "success");
    document.getElementById("feedback-form").reset();
  });
}
