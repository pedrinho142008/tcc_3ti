/* Menu mobile — funciona em todas as páginas */
(function () {
  function initMenu() {
    var btn = document.querySelector(".menu-btn");
    var links = document.querySelector(".nav-links");
    if (!btn || !links) return;

    if (btn.dataset.menuReady === "1") return;
    btn.dataset.menuReady = "1";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      links.classList.toggle("open");
    });

    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        // Não fecha em links externos nem no Portal do Estudante
        if (a.hasAttribute("data-portal")) return;
        if (a.target === "_blank") return;
        links.classList.remove("open");
      });
    });

    document.addEventListener("click", function (e) {
      if (!links.classList.contains("open")) return;
      if (btn.contains(e.target) || links.contains(e.target)) return;
      links.classList.remove("open");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMenu);
  } else {
    initMenu();
  }
})();
