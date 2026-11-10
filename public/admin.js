(() => {
  const prompts = {
    "data-confirm-delete": "Delete this waitlist entry?",
    "data-confirm-provision":
      "Create the Calagopus account and server, then send the DM and email?",
  };

  // Keep the sign-up table current while staff leave the tab open. Defer the
  // reload while a field is focused so a half-filled settings edit isn't wiped.
  // Clear the timer before any POST so a due reload cannot abort the request.
  const REFRESH_MS = 60_000;
  const DEFER_MS = 5_000;
  let refreshTimer = 0;

  const clearRefresh = () => {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
      refreshTimer = 0;
    }
  };

  const scheduleRefresh = (delayMs = REFRESH_MS) => {
    clearRefresh();
    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        scheduleRefresh(DEFER_MS);
        return;
      }
      location.reload();
    }, delayMs);
  };

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    // Stop auto-refresh for the lifetime of this navigation attempt. A due
    // setTimeout must not call location.reload() and cancel the POST.
    clearRefresh();

    for (const [attribute, prompt] of Object.entries(prompts)) {
      if (!form.hasAttribute(attribute)) continue;
      if (!window.confirm(prompt)) {
        event.preventDefault();
        scheduleRefresh();
      }
      return;
    }
  });

  scheduleRefresh();
})();
