/* ============================================================
   MENU DELEGATION — funciona em qualquer painel
   Anexa um listener global que captura cliques em botões do menu
   ============================================================ */
(function () {
  function getAba(el) {
    return el.dataset.aba || el.dataset.abaTop;
  }

  function getPainel() {
    // Detecta qual painel estamos
    if (document.getElementById("conteudo-aluno")) return "aluno";
    if (document.getElementById("conteudo-prof")) return "professor";
    if (document.getElementById("admin-conteudo")) return "admin";
    return null;
  }

  function getConteudoId() {
    const painel = getPainel();
    if (painel === "aluno") return "conteudo-aluno";
    if (painel === "professor") return "conteudo-prof";
    if (painel === "admin") return "admin-conteudo";
    return null;
  }

  function getTituloId() {
    const painel = getPainel();
    if (painel === "aluno") return { titulo: "titulo-aba", sub: "sub-aba" };
    if (painel === "professor") return { titulo: "titulo-aba", sub: "sub-aba" };
    if (painel === "admin") return { titulo: "admin-titulo", sub: "admin-sub" };
    return null;
  }

  // Listener global — pega QUALQUER clique em botões do menu
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".painel-nav-item, .painel-topnav-item");
    if (!btn) return;

    const aba = getAba(btn);
    if (!aba) return;

    e.preventDefault();
    e.stopPropagation();

    // Marca ativo
    document.querySelectorAll(".painel-nav-item, .painel-topnav-item").forEach(x => {
      x.classList.toggle("ativo", getAba(x) === aba);
    });

    // Atualiza título se houver
    const titulosEl = getTituloId();
    if (titulosEl && window.titulos && window.titulos[aba]) {
      const t = window.titulos[aba];
      const elTitulo = document.getElementById(titulosEl.titulo);
      const elSub = document.getElementById(titulosEl.sub);
      const elTop = document.getElementById("topbar-aba");
      if (elTitulo) elTitulo.textContent = t[0];
      if (elSub) elSub.textContent = t[1];
      if (elTop) elTop.textContent = t[0];
    }

    // Fecha menu (mobile)
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    const hamburger = document.getElementById("btn-hamburger");
    if (window.innerWidth < 900) {
      sidebar?.classList.remove("aberto");
      overlay?.classList.remove("ativo");
      hamburger?.classList.remove("aberto");
    }

    // Chama carregar (se existir)
    if (typeof window.carregar === "function") {
      window.carregar(aba);
    } else if (typeof carregar === "function") {
      carregar(aba);
    }
  }, true); // useCapture = true pra pegar antes dos outros listeners

  console.log("[menu-delegation] instalado");
})();
