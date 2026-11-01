const form = document.querySelector("#waitlist-form");
const copyNode = document.querySelector("#waitlist-copy");

if (form instanceof HTMLFormElement && copyNode instanceof HTMLScriptElement) {
  const copy = JSON.parse(copyNode.textContent || "{}");
  const alertBox = document.querySelector("#form-alert");

  const showError = (message) => {
    let box = alertBox;
    if (!(box instanceof HTMLElement)) {
      box = document.createElement("p");
      box.id = "form-alert";
      box.className = "alert";
      box.setAttribute("role", "alert");
      form.before(box);
    }
    box.hidden = false;
    box.textContent = message;
  };

  form.addEventListener("submit", async (event) => {
    const submitter = event.submitter;
    if (submitter instanceof HTMLButtonElement && submitter.hasAttribute("formaction")) return;
    event.preventDefault();
    const button = form.querySelector("[data-email-submit]");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        showError(data.message || copy.generic);
        if (window.turnstile) window.turnstile.reset();
        return;
      }
      const section = document.createElement("section");
      section.className = "card success";
      const heading = document.createElement("h2");
      heading.id = "success-heading";
      heading.textContent = copy.successHeading;
      section.append(heading);
      if (data.existing) {
        const existing = document.createElement("p");
        existing.textContent = copy.existing;
        section.append(existing);
      }
      const reached = document.createElement("p");
      reached.textContent = String(copy.reached).replace("{email}", String(data.email));
      section.append(reached);
      const place = document.createElement("p");
      place.className = "place";
      place.textContent = String(copy.place).replace("{position}", String(data.position));
      const note = document.createElement("p");
      note.textContent = copy.referral;
      const label = document.createElement("label");
      label.htmlFor = "referral-link";
      label.textContent = copy.linkLabel;
      const input = document.createElement("input");
      input.id = "referral-link";
      input.readOnly = true;
      input.value = data.referralUrl;
      section.append(place, note, label, input);
      if (data.discordInviteUrl) {
        const link = document.createElement("a");
        link.className = "button button-secondary";
        link.href = data.discordInviteUrl;
        link.textContent = copy.discord;
        const paragraph = document.createElement("p");
        paragraph.append(link);
        section.append(paragraph);
      }
      section.tabIndex = -1;
      (form.closest("section") ?? form).replaceWith(section);
      section.focus();
    } catch {
      showError(copy.generic);
    } finally {
      if (button instanceof HTMLButtonElement && button.isConnected) button.disabled = false;
    }
  });
}
