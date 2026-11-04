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
})();
