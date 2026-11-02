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
    if (tokenValue()) return;
    event.preventDefault();
    setReady(false);
    if (status instanceof HTMLElement) {
      status.hidden = false;
      status.textContent = "Complete the check below, then continue.";
    }
    if (window.turnstile) window.turnstile.reset();
  });
})();
