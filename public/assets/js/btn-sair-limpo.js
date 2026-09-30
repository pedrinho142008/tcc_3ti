/* ============================================================
   BOTÃO SAIR — reescreve o botão, garante que funcione
   ============================================================ */
(function () {
  function instalar() {
    const btn = document.getElementById("btn-sair");
    if (!btn) return;

    // Clona o botão pra remover TODOS os listeners antigos
    const btnNovo = btn.cloneNode(true);
    btn.parentNode.replaceChild(btnNovo, btn);

    btnNovo.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Feedback visual
      btnNovo.style.opacity = "0.5";
      btnNovo.style.pointerEvents = "none";

      try {
        await fetch("/api/users/logout", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      } catch (err) {
        console.error("Erro no logout:", err);
      } finally {
        // Limpa tudo
        try {
          localStorage.clear();
        } catch {}
        // Redireciona
        window.location.href = "/";
      }
    });

    console.log("[btn-sair-limpo] instalado");
  }

  // Instala quando a página terminar de carregar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar);
  } else {
    instalar();
  }
  setTimeout(instalar, 1000);
})();
