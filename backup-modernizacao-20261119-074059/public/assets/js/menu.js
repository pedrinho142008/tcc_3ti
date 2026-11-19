/* ============================================================
   Menu mobile — robusto, funciona em qualquer página
   ============================================================ */
(function () {
  function initMenu() {
    var btn = document.querySelector(".menu-btn");
    var links = document.querySelector(".nav-links");
    if (!btn || !links) return;
    if (btn.dataset.menuReady === "1") return;
    btn.dataset.menuReady = "1";

    // Remove listeners antigos clonando o botão (garante estado limpo)
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    btn = clone;
    btn.dataset.menuReady = "1";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      links.classList.toggle("open");
    }, false);

    // Fecha ao clicar num link
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        if (a.hasAttribute("data-portal")) return;
        if (a.target === "_blank") return;
        links.classList.remove("open");
      });
    });

    // Fecha ao clicar fora
    document.addEventListener("click", function (e) {
      if (!links.classList.contains("open")) return;
      if (btn.contains(e.target) || links.contains(e.target)) return;
      links.classList.remove("open");
    });
  }

  // Tenta em vários momentos (por causa de módulos assíncronos)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMenu);
  } else {
    initMenu();
  }
  setTimeout(initMenu, 100);
  setTimeout(initMenu, 500);
  setTimeout(initMenu, 1500);
  setTimeout(initMenu, 3000);
})();
