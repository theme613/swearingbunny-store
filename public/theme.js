(() => {
  const key = "swaeringbunny.theme";
  const root = document.documentElement;
  let theme = "dark";
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") theme = saved;
  } catch { /* Theme switching still works when storage is disabled. */ }

  function apply(next) {
    theme = next;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#ffffff" : "#101410");
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      const target = theme === "dark" ? "light" : "dark";
      button.setAttribute("aria-label", "Switch to " + target + " theme");
      button.setAttribute("aria-pressed", String(theme === "light"));
      button.title = "Switch to " + target + " theme";
      button.querySelector("[data-theme-label]").textContent = target === "light" ? "Light mode" : "Dark mode";
      button.querySelector("i").className = "fa-solid " + (target === "light" ? "fa-sun" : "fa-moon");
    });
  }

  apply(theme);
  document.addEventListener("DOMContentLoaded", () => {
    apply(theme);
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        apply(theme === "dark" ? "light" : "dark");
        try { localStorage.setItem(key, theme); } catch { /* Keep the current choice for this page. */ }
      });
    });
  });
  window.addEventListener("storage", event => {
    if (event.key === key) apply(event.newValue === "light" ? "light" : "dark");
  });
})();
