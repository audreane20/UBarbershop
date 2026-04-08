document.addEventListener("DOMContentLoaded", () => {
  function markActiveLinks() {
    const path = window.location.pathname.split("/").pop() || "home.html";
    const selectors = [".main-nav a", ".drawer-links a"];
    document.querySelectorAll(selectors.join(", ")).forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      a.classList.toggle("active", href === path);
    });
  }

  markActiveLinks();
  setTimeout(markActiveLinks, 0);
  setTimeout(markActiveLinks, 120);
});
