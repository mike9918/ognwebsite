(() => {
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.hasAttribute("data-confirm-delete")) return;
    if (!window.confirm("Delete this waitlist entry?")) {
      event.preventDefault();
    }
  });
})();
