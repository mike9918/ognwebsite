(() => {
  const form = document.querySelector("#waitlist-form");
  if (!(form instanceof HTMLFormElement)) return;

  const button = form.querySelector("[data-discord-submit]");
  const status = form.querySelector("[data-turnstile-status]");

  const tokenValue = () => {
    const token = form.querySelector("[name='cf-turnstile-response']");
    return token instanceof HTMLInputElement ? token.value.trim() : "";
  };

  const setReady = (ready) => {
    if (button instanceof HTMLButtonElement) button.disabled = !ready;
    if (status instanceof HTMLElement) {
      status.hidden = ready;
      status.textContent = ready ? "" : "Complete the check below, then continue.";
    }
  };

  const showStatus = (message) => {
    if (status instanceof HTMLElement) {
      status.hidden = false;
      status.textContent = message;
    }
  };

  const syncFromToken = () => setReady(Boolean(tokenValue()));

  window.__ognTurnstileSuccess = () => setReady(true);
  window.__ognTurnstileExpired = () => {
    setReady(false);
    if (window.turnstile) window.turnstile.reset();
  };
  window.__ognTurnstileError = () => setReady(false);

  // Recover if Turnstile finished before this script ran.
  syncFromToken();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!tokenValue()) {
      setReady(false);
      showStatus("Complete the check below, then continue.");
      if (window.turnstile) window.turnstile.reset();
      return;
    }

    if (button instanceof HTMLButtonElement) button.disabled = true;
    showStatus("Redirecting to Discord…");

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(async (response) => {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        if (response.ok && payload && typeof payload.location === "string") {
          window.location.assign(payload.location);
          return;
        }
        const error = payload && typeof payload.error === "string" ? payload.error : "turnstile";
        window.location.assign(`/wishlist?error=${encodeURIComponent(error)}`);
      })
      .catch(() => {
        setReady(Boolean(tokenValue()));
        showStatus("Something went wrong. Please try again.");
        if (window.turnstile) window.turnstile.reset();
      });
  });
})();
