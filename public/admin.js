(() => {
  const prompts = {
    "data-confirm-delete": "Delete this waitlist entry?",
    "data-confirm-provision":
      "Create the Calagopus account and server, then send the DM and email?",
  };

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    for (const [attribute, prompt] of Object.entries(prompts)) {
      if (!form.hasAttribute(attribute)) continue;
      if (!window.confirm(prompt)) event.preventDefault();
      return;
    }
  });

  // Keep the sign-up table current while staff leave the tab open. Defer the
  // reload while a field is focused so a half-filled settings edit isn't wiped.
  const REFRESH_MS = 60_000;
  const DEFER_MS = 5_000;
  const scheduleRefresh = (delayMs = REFRESH_MS) => {
    window.setTimeout(() => {
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
  scheduleRefresh();
})();
