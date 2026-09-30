import { api, esc, fmtData, mostrarLoading, esconderLoading, periodoNome } from "/assets/js/shared.js";

/* ============================================================
   USUÁRIO LOGADO
   ============================================================ */
let user = null;
let imagemAtualUrl = null;
try { user = await api("/api/users/me"); } catch { window.location.href = "/login.html"; }

const nomeUser = user?.nome || "—";
const cargoUser = user?.cargo || user?.tipo || "—";
const inicialUser = nomeUser.charAt(0).toUpperCase();

const setTxt = (id, v) => {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
};

setTxt("user-nome", nomeUser);
setTxt("user-avatar", inicialUser);
setTxt("user-nome-sidebar", nomeUser);
setTxt("user-cargo-sidebar", cargoUser);
setTxt("user-avatar-sidebar", inicialUser);

document.getElementById("btn-sair")?.addEventListener("click", async () => {
  await api("/api/users/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/";
});

/* ============================================================
   MENU HAMBÚRGUER
   ============================================================ */
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const hamburger = document.getElementById("btn-hamburger");

const abrirMenu = () => {
  sidebar?.classList.add("aberto");
  overlay?.classList.add("ativo");
  hamburger?.classList.add("aberto");
};

const fecharMenu = () => {
  sidebar?.classList.remove("aberto");
  overlay?.classList.remove("ativo");
  hamburger?.classList.remove("aberto");
};

hamburger?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (sidebar?.classList.contains("aberto")) fecharMenu();
  else abrirMenu();
});

overlay?.addEventListener("click", fecharMenu);

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const titulos = {
  posts:        ["Postagens",             "Gerencie as publicações do site"],
  avisos:       ["Avisos",                "Comunicados rápidos"],
  eventos:      ["Eventos",               "Agenda escolar"],
  merenda:      ["Merenda",               "Cardápio diário"],
  turmas:       ["Turmas",                "Gerencie os alunos de cada turma"],
  usuarios:     ["Usuários",              "Funcionários e administradores"],
  pedidos:      ["Pedidos de cadastro",   "Aprove ou rejeite novos cadastros"],
  codigos:      ["Códigos de vínculo",    "Gere códigos para pais"],
  mural:        ["Mural de Honra",        "Destaques do mês"],
  certificados: ["Certificados",          "Emita certificados"],
};

document.querySelectorAll(".painel-nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".painel-nav-item").forEach((x) => x.classList.remove("ativo"));
    btn.classList.add("ativo");
    const aba = btn.dataset.aba;
    setTxt("admin-titulo", titulos[aba][0]);
    setTxt("admin-sub", titulos[aba][1]);
    setTxt("topbar-aba", titulos[aba][0]);
    if (window.innerWidth < 900) fecharMenu();
    carregar(aba);
  });
});

/* ============================================================
   ROUTER
   ============================================================ */
async function carregar(aba) {
  const el = document.getElementById("admin-conteudo");
  if (!el) return;
  el.innerHTML = `<div class="admin-section"><p style="color:#8895a7">Carregando...</p></div>`;
  try {
    let html = "";
    if (aba === "posts")        html = await renderPosts();
    if (aba === "avisos")       html = await renderAvisos();
    if (aba === "eventos")      html = await renderEventos();
    if (aba === "merenda")      html = await renderMerenda();
    if (aba === "turmas")       html = await renderTurmasAdmin();
    if (aba === "usuarios")     html = await renderUsuarios();
    if (aba === "pedidos")      html = await renderPedidos();
    if (aba === "codigos")      html = await renderCodigos();
    if (aba === "mural")        html = await renderMuralAdmin();
    if (aba === "certificados") html = await renderCertificados();
    el.innerHTML = html;
    bind(aba);
  } catch (e) {
    console.error("Erro:", e);
    el.innerHTML = `<div class="admin-section"><p style="color:#c53030">Erro: ${esc(e.message)}</p></div>`;
  }
}

/* ============================================================
   POSTS — com upload de imagem OU URL
   ============================================================ */
async function renderPosts() {
  const posts = await api("/api/posts").catch(() => []);

  return `
    <div class="admin-section">
      <div class="admin-section-title">➕ Nova postagem</div>
      <form id="f-post" class="admin-form">
        <label>Título
          <input name="titulo" required placeholder="Ex: Semana da leitura" />
        </label>
        <label>Texto
          <textarea name="texto" required placeholder="Conteúdo da postagem..."></textarea>
        </label>

        <label>Imagem da postagem</label>

        <div style="background:#f8fafc;border:1.5px solid #e6e9ef;border-radius:16px;padding:16px;margin-bottom:16px">
          <div id="imagem-preview" style="width:100%;min-height:160px;background:white;border:2px dashed #c7d2e0;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:12px">
            <div style="text-align:center;color:#8895a7;padding:20px">
              <div style="font-size:2rem;opacity:0.4">🖼️</div>
              <div style="font-size:0.82rem;margin-top:6px">Nenhuma imagem selecionada</div>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" id="btn-escolher-arquivo"
              style="flex:1;min-width:150px;padding:12px 16px;border:none;border-radius:12px;background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer">
              📷 Escolher do dispositivo
            </button>
            <button type="button" id="btn-usar-url"
              style="flex:1;min-width:150px;padding:12px 16px;border:1.5px solid #e6e9ef;border-radius:12px;background:white;color:#2a5298;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer">
              🔗 Usar URL
            </button>
          </div>

          <input type="file" id="input-arquivo" accept="image/*" style="display:none" />

          <div id="url-box" style="display:none;margin-top:12px">
            <input type="url" id="input-url" placeholder="https://exemplo.com/foto.jpg"
              style="width:100%;padding:12px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:white" />
            <button type="button" id="btn-confirmar-url"
              style="margin-top:8px;width:100%;padding:10px;border:none;border-radius:10px;background:#2a5298;color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer">
              ✅ Usar essa URL
            </button>
          </div>

          <input type="hidden" name="imagem_url" id="imagem-url-final" />
        </div>

        <label>Categoria
          <select name="categoria">
            <option value="noticia">Notícia</option>
            <option value="evento">Evento</option>
            <option value="aviso">Aviso</option>
            <option value="conquista">Conquista</option>
          </select>
        </label>

        <label style="display:flex;align-items:center;gap:8px;text-transform:none">
          <input type="checkbox" name="fixada" style="width:auto" /> Fixar no topo
        </label>

        <button type="submit" class="admin-btn">📢 Publicar postagem</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Postagens (${posts.length})</div>
      ${posts.length ? `<div class="admin-list">${posts.map((p) => `
        <div class="admin-item">
          <div class="admin-item-content">
            ${p.imagem_url ? `<img src="${esc(p.imagem_url)}" alt="" style="width:70px;height:70px;object-fit:cover;border-radius:10px;float:right;margin-left:12px;background:#f5f7fa" onerror="this.style.display='none'" />` : ""}
            <div class="admin-item-title">${esc(p.titulo)}</div>
            <div class="admin-item-meta">
              <span class="admin-badge ${p.categoria}">${p.categoria}</span>
              ${fmtData(p.criado_em)}
            </div>
            <div class="admin-item-text">${esc(p.texto)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-post" data-id="${p.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `
        <div class="admin-empty">
          <div class="admin-empty-icon">▤</div>
          Nenhuma postagem ainda
        </div>`}
    </div>
  `;
}

function bindPosts() {
  const preview = document.getElementById("imagem-preview");
  const inputArquivo = document.getElementById("input-arquivo");
  const inputUrl = document.getElementById("input-url");
  const urlBox = document.getElementById("url-box");
  const urlFinal = document.getElementById("imagem-url-final");
  const btnEscolher = document.getElementById("btn-escolher-arquivo");
  const btnUsarUrl = document.getElementById("btn-usar-url");
  const btnConfirmarUrl = document.getElementById("btn-confirmar-url");

  btnEscolher?.addEventListener("click", () => inputArquivo.click());

  btnUsarUrl?.addEventListener("click", () => {
    urlBox.style.display = urlBox.style.display === "none" ? "block" : "none";
    if (urlBox.style.display === "block") inputUrl.focus();
  });

  inputArquivo?.addEventListener("change", async () => {
    const f = inputArquivo.files[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:280px;object-fit:contain;border-radius:10px" />`;
    };
    reader.readAsDataURL(f);

    mostrarLoading("Enviando imagem...");
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      const r = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || "Falha no upload");
      urlFinal.value = data.url;
      imagemAtualUrl = data.url;
      console.log("✅ Imagem enviada:", data.url);
    } catch (err) {
      alert("Erro no upload: " + err.message);
      preview.innerHTML = `<div style="text-align:center;color:#e53e3e;padding:20px"><div style="font-size:2rem">❌</div><div style="font-size:0.82rem;margin-top:6px">Erro no upload</div></div>`;
    } finally {
      esconderLoading();
    }
  });

  btnConfirmarUrl?.addEventListener("click", () => {
    const url = inputUrl.value.trim();
    if (!url) return alert("Cole uma URL primeiro");
    if (!/^https?:\/\//.test(url)) return alert("URL inválida. Deve começar com http:// ou https://");

    urlFinal.value = url;
    imagemAtualUrl = url;
    preview.innerHTML = `<img src="${esc(url)}" style="width:100%;max-height:280px;object-fit:contain;border-radius:10px" onerror="this.parentElement.innerHTML='<div style=text-align:center;color:#e53e3e;padding:20px><div style=font-size:2rem>❌</div><div>Não foi possível carregar</div></div>'" />`;
  });

  document.getElementById("f-post")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    mostrarLoading("Publicando...");
    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          titulo: fd.get("titulo"),
          texto: fd.get("texto"),
          imagem_url: imagemAtualUrl || urlFinal.value || null,
          categoria: fd.get("categoria"),
          fixada: fd.get("fixada") === "on",
        }),
      });
      imagemAtualUrl = null;
      carregar("posts");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });

  document.querySelectorAll(".del-post").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api("/api/posts/" + b.dataset.id, { method: "DELETE" });
      carregar("posts");
      esconderLoading();
    });
  });
}

/* ============================================================
   AVISOS
   ============================================================ */
async function renderAvisos() {
  const avisos = await api("/api/announcements").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">➕ Novo aviso</div>
      <form id="f-aviso" class="admin-form">
        <label>Texto<textarea name="texto" required></textarea></label>
        <label style="display:flex;gap:8px;text-transform:none">
          <input type="checkbox" name="urgente" style="width:auto" /> Urgente
        </label>
        <button type="submit" class="admin-btn">Publicar aviso</button>
      </form>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">Avisos (${avisos.length})</div>
      ${avisos.length ? `<div class="admin-list">${avisos.map((a) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-meta"><span class="admin-badge ${a.urgente ? "urgente" : ""}">${a.urgente ? "Urgente" : "Normal"}</span></div>
            <div class="admin-item-text">${esc(a.texto)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-aviso" data-id="${a.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `<div class="admin-empty">Nenhum aviso</div>`}
    </div>`;
}

function bindAvisos() {
  document.getElementById("f-aviso")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/announcements", { method: "POST", body: JSON.stringify({
        texto: fd.get("texto"), urgente: fd.get("urgente") === "on",
      })});
      carregar("avisos");
    } catch (err) { alert("Erro: " + err.message); esconderLoading(); }
  });
  document.querySelectorAll(".del-aviso").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api("/api/announcements/" + b.dataset.id, { method: "DELETE" });
      carregar("avisos"); esconderLoading();
    });
  });
}

/* ============================================================
   EVENTOS
   ============================================================ */
async function renderEventos() {
  const evs = await api("/api/events").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">➕ Novo evento</div>
      <form id="f-evento" class="admin-form">
        <label>Título<input name="titulo" required /></label>
        <label>Descrição<textarea name="descricao"></textarea></label>
        <label>Local<input name="local" /></label>
        <label>Início<input type="datetime-local" name="data_inicio" required /></label>
        <label>Fim<input type="datetime-local" name="data_fim" /></label>
        <button type="submit" class="admin-btn">Criar evento</button>
      </form>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">Eventos (${evs.length})</div>
      ${evs.length ? `<div class="admin-list">${evs.map((e) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(e.titulo)}</div>
            <div class="admin-item-meta">${fmtData(e.data_inicio)}${e.local ? " — " + esc(e.local) : ""}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-evento" data-id="${e.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `<div class="admin-empty">Nenhum evento</div>`}
    </div>`;
}

function bindEventos() {
  document.getElementById("f-evento")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/events", { method: "POST", body: JSON.stringify({
        titulo: fd.get("titulo"), descricao: fd.get("descricao"), local: fd.get("local"),
        data_inicio: new Date(fd.get("data_inicio")).toISOString(),
        data_fim: fd.get("data_fim") ? new Date(fd.get("data_fim")).toISOString() : null,
      })});
      carregar("eventos");
    } catch (err) { alert("Erro: " + err.message); esconderLoading(); }
  });
  document.querySelectorAll(".del-evento").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api("/api/events/" + b.dataset.id, { method: "DELETE" });
      carregar("eventos"); esconderLoading();
    });
  });
}

/* ============================================================
   MERENDA
   ============================================================ */
async function renderMerenda() {
  const ms = await api("/api/meals").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">➕ Cadastrar merenda</div>
      <form id="f-merenda" class="admin-form">
        <label>Data<input type="date" name="data" required /></label>
        <label>Período
          <select name="periodo" required>
            <option value="manha">Manhã</option>
            <option value="almoco">Almoço</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
          </select>
        </label>
        <label>Descrição<textarea name="descricao" required></textarea></label>
        <button type="submit" class="admin-btn">Salvar</button>
      </form>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">Merenda (${ms.length})</div>
      ${ms.length ? `<div class="admin-list">${ms.map((m) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(m.descricao)}</div>
            <div class="admin-item-meta">${fmtData(m.data)} — ${periodoNome(m.periodo)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-merenda" data-id="${m.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `<div class="admin-empty">Nenhuma merenda</div>`}
    </div>`;
}

function bindMerenda() {
  document.getElementById("f-merenda")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/meals", { method: "POST", body: JSON.stringify({
        data: fd.get("data"), periodo: fd.get("periodo"), descricao: fd.get("descricao"),
      })});
      carregar("merenda");
    } catch (err) { alert("Erro: " + err.message); esconderLoading(); }
  });
  document.querySelectorAll(".del-merenda").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api("/api/meals/" + b.dataset.id, { method: "DELETE" });
      carregar("merenda"); esconderLoading();
    });
  });
}

/* ============================================================
   USUÁRIOS
   ============================================================ */
async function renderUsuarios() {
  const us = await api("/api/users").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">➕ Novo usuário</div>
      <form id="f-user" class="admin-form">
        <label>Nome<input name="nome" required /></label>
        <label>Email<input type="email" name="email" required /></label>
        <label>Senha<input type="password" name="senha" required /></label>
        <label>Tipo
          <select name="tipo">
            <option value="funcionario">Funcionário</option>
            <option value="professor">Professor</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label>Cargo<input name="cargo" /></label>
        <button type="submit" class="admin-btn">Criar</button>
      </form>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">Usuários (${us.length})</div>
      ${us.length ? `<div class="admin-list">${us.map((u) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(u.nome)}</div>
            <div class="admin-item-meta"><span class="admin-badge">${u.tipo}</span> ${esc(u.cargo || "—")} — ${esc(u.email)}</div>
          </div>
        </div>`).join("")}</div>` : `<div class="admin-empty">Nenhum usuário</div>`}
    </div>`;
}

function bindUsuarios() {
  document.getElementById("f-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({
        nome: fd.get("nome"), email: fd.get("email"), senha: fd.get("senha"),
        tipo: fd.get("tipo"), cargo: fd.get("cargo"),
      })});
      carregar("usuarios");
    } catch (err) { alert("Erro: " + err.message); esconderLoading(); }
  });
}

/* ============================================================
   PEDIDOS
   ============================================================ */
async function renderPedidos() {
  const pedidos = await api("/api/cadastro?status=pendente").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">Pedidos pendentes (${pedidos.length})</div>
      ${pedidos.length ? `<div class="admin-list">${pedidos.map((p) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(p.nome)}</div>
            <div class="admin-item-meta"><span class="admin-badge">${esc(p.tipo)}</span> ${esc(p.email)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn aprovar-pedido" data-id="${p.id}" style="background:#38a169;color:white">✓ Aprovar</button>
            <button class="admin-btn admin-btn-danger rejeitar-pedido" data-id="${p.id}">✕ Rejeitar</button>
          </div>
        </div>`).join("")}</div>` : `<div class="admin-empty">Nenhum pedido</div>`}
    </div>`;
}

function bindPedidos() {
  document.querySelectorAll(".aprovar-pedido").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Aprovar?")) return;
      mostrarLoading("Aprovando...");
      try {
        await api(`/api/cadastro/${b.dataset.id}/aprovar`, { method: "POST" });
        alert("✅ Aprovado!");
        carregar("pedidos");
      } catch (e) { alert("Erro: " + e.message); esconderLoading(); }
    });
  });
  document.querySelectorAll(".rejeitar-pedido").forEach((b) => {
    b.addEventListener("click", async () => {
      const motivo = prompt("Motivo (opcional):");
      if (motivo === null) return;
      mostrarLoading("Rejeitando...");
      try {
        await api(`/api/cadastro/${b.dataset.id}/rejeitar`, { method: "POST", body: JSON.stringify({ motivo }) });
        carregar("pedidos");
      } catch (e) { alert("Erro: " + e.message); esconderLoading(); }
    });
  });
}

/* ============================================================
   TURMAS
   ============================================================ */
let turmaSelecionada = "3º Ano T.I";

async function renderTurmasAdmin() {
  const turmas = await api("/api/turmas/lista-disponiveis").catch(() => []);
  const stats = await api("/api/turmas/estatisticas").catch(() => ({}));

  if (!turmas.includes(turmaSelecionada)) {
    turmaSelecionada = turmas[0] || "3º Ano T.I";
  }

  return `
    <div class="admin-section">
      <div class="admin-section-title">🏫 Turmas</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px">
        ${turmas.map((t) => `
          <button class="turma-selector ${t === turmaSelecionada ? "ativo" : ""}" data-turma="${esc(t)}"
            style="padding:14px;border-radius:12px;border:2px solid ${t === turmaSelecionada ? "#2a5298" : "#e6e9ef"};
                   background:${t === turmaSelecionada ? "#eef3fb" : "white"};
                   color:${t === turmaSelecionada ? "#1e3c72" : "#5a6472"};
                   font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer">
            <div style="font-size:0.95rem;margin-bottom:4px">${esc(t)}</div>
            <div style="font-size:0.7rem;opacity:0.7;font-weight:600">${stats[t] || 0} aluno(s)</div>
          </button>
        `).join("")}
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">📋 ${esc(turmaSelecionada)}</div>
      <div style="background:#f8fafc;border-radius:14px;padding:18px;margin-bottom:16px">
        <div style="font-weight:700;color:#1e3c72;font-size:0.9rem;margin-bottom:8px">📋 Colar lista (Smart Paste)</div>
        <textarea id="smart-paste" placeholder="Cole a lista aqui (um aluno por linha)..."
          style="width:100%;min-height:150px;padding:12px;border:1.5px solid #e6e9ef;border-radius:10px;font-family:monospace;font-size:0.82rem;background:white;resize:vertical"></textarea>
        <button id="btn-importar-texto" class="admin-btn" style="margin-top:12px;width:100%">📥 Importar todos</button>
        <div id="paste-resultado" style="margin-top:10px"></div>
      </div>

      <div style="background:#f8fafc;border-radius:14px;padding:18px;margin-bottom:16px">
        <div style="font-weight:700;color:#1e3c72;font-size:0.9rem;margin-bottom:12px">➕ Cadastrar um aluno</div>
        <form id="form-cad-aluno" class="admin-form">
          <label>Matrícula<input name="matricula" required /></label>
          <label>Nome<input name="nome" required /></label>
          <button type="submit" class="admin-btn" style="width:100%">Cadastrar</button>
        </form>
      </div>

      <div id="lista-alunos-turma"></div>
    </div>
  `;
}

function bindTurmasAdmin() {
  document.querySelectorAll(".turma-selector").forEach((b) => {
    b.addEventListener("click", () => {
      turmaSelecionada = b.dataset.turma;
      carregar("turmas");
    });
  });

  document.getElementById("btn-importar-texto")?.addEventListener("click", async () => {
    const texto = document.getElementById("smart-paste").value.trim();
    if (!texto) return alert("Cole alguma lista primeiro");
    mostrarLoading("Importando...");
    try {
      const r = await api(`/api/turmas/${encodeURIComponent(turmaSelecionada)}/importar-texto`, {
        method: "POST", body: JSON.stringify({ texto }),
      });
      document.getElementById("paste-resultado").innerHTML =
        `<div style="padding:10px;background:#d1fae5;border-radius:10px;color:#065f46;font-size:0.82rem">✅ ${r.importados} aluno(s) importado(s)</div>`;
      document.getElementById("smart-paste").value = "";
      await renderListaAlunos();
    } catch (e) {
      document.getElementById("paste-resultado").innerHTML =
        `<div style="padding:10px;background:#fee2e2;border-radius:10px;color:#991b1b;font-size:0.82rem">❌ ${esc(e.message)}</div>`;
    } finally { esconderLoading(); }
  });

  document.getElementById("form-cad-aluno")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Cadastrando...");
    try {
      await api(`/api/turmas/${encodeURIComponent(turmaSelecionada)}/cadastrar`, {
        method: "POST", body: JSON.stringify({ matricula: fd.get("matricula"), nome: fd.get("nome") }),
      });
      e.target.reset();
      await renderListaAlunos();
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });

  renderListaAlunos();
}

async function renderListaAlunos() {
  const el = document.getElementById("lista-alunos-turma");
  if (!el) return;
  const alunos = await api(`/api/turmas/${encodeURIComponent(turmaSelecionada)}/alunos`).catch(() => []);

  if (alunos.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:#8895a7">Nenhum aluno nesta turma</div>`;
    return;
  }

  el.innerHTML = `
    <div class="admin-section-title" style="margin-top:8px">👥 Alunos (${alunos.length})</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${alunos.map((a) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8fafc;border-radius:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem">
            ${esc((a.nome || "?").charAt(0))}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:#1e3c72;font-size:0.88rem">${esc(a.nome)}</div>
            <div style="font-size:0.72rem;color:#8895a7">${esc(a.matricula)}</div>
          </div>
          <button class="btn-del-aluno-turma" data-id="${a.id}"
            style="padding:6px 12px;background:#fee2e2;color:#991b1b;border:none;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer">Excluir</button>
        </div>
      `).join("")}
    </div>
  `;

  el.querySelectorAll(".btn-del-aluno-turma").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api(`/api/turmas/alunos/${b.dataset.id}`, { method: "DELETE" });
      renderListaAlunos(); esconderLoading();
    });
  });
}

/* ============================================================
   CÓDIGOS
   ============================================================ */
async function renderCodigos() {
  const codigos = await api("/api/pais/admin/codigos").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">🔑 Gerar código</div>
      <form id="f-codigo" class="admin-form">
        <label>Matrícula<input name="aluno_matricula" required /></label>
        <label>Nome<input name="aluno_nome" required /></label>
        <button type="submit" class="admin-btn">Gerar</button>
      </form>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">Códigos (${codigos.length})</div>
      ${codigos.length ? `<div class="admin-list">${codigos.map((c) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title" style="font-family:monospace;color:#2a5298">${esc(c.codigo)}</div>
            <div class="admin-item-meta">${esc(c.aluno_nome || "?")} (${esc(c.aluno_matricula)}) — ${c.usado ? "✅ Usado" : "⏳ Livre"}</div>
          </div>
        </div>`).join("")}</div>` : `<div class="admin-empty">Nenhum</div>`}
    </div>`;
}

function bindCodigos() {
  document.getElementById("f-codigo")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Gerando...");
    try {
      const r = await api("/api/pais/admin/gerar-codigo", { method: "POST", body: JSON.stringify({
        aluno_matricula: fd.get("aluno_matricula"), aluno_nome: fd.get("aluno_nome"),
      })});
      alert(`✅ Código: ${r.codigo}`);
      carregar("codigos");
    } catch (err) { alert("Erro: " + err.message); esconderLoading(); }
  });
}

/* ============================================================
   MURAL
   ============================================================ */
async function renderMuralAdmin() {
  const atual = await api("/api/premios/mural/atual").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">🏛️ Mural de Honra</div>
      <p style="color:#5a6472;font-size:0.9rem;margin-bottom:16px">Pega os 3 alunos com mais pontos do mês.</p>
      <button id="btn-gerar-mural" class="admin-btn">🎖️ Gerar Mural</button>
    </div>
    ${atual.length ? `
      <div class="admin-section">
        <div class="admin-section-title">Destaques</div>
        <div class="admin-list">${atual.map((a) => `
          <div class="admin-item">
            <div class="admin-item-content">
              <div class="admin-item-title">${a.posicao === 1 ? "🥇" : a.posicao === 2 ? "🥈" : "🥉"} ${esc(a.aluno_nome)}</div>
              <div class="admin-item-meta">${esc(a.turma || "—")} — ${a.pontos} pts</div>
            </div>
          </div>`).join("")}</div>
      </div>` : ""}
  `;
}

function bindMuralAdmin() {
  document.getElementById("btn-gerar-mural")?.addEventListener("click", async () => {
    if (!confirm("Gerar Mural deste mês?")) return;
    mostrarLoading("Gerando...");
    try {
      await api("/api/premios/mural/gerar", { method: "POST" });
      alert("✅ Mural atualizado!");
      carregar("mural");
    } catch (e) { alert("Erro: " + e.message); esconderLoading(); }
  });
}

/* ============================================================
   CERTIFICADOS
   ============================================================ */
async function renderCertificados() {
  const certificados = await api("/api/premios/certificados").catch(() => []);
  return `
    <div class="admin-section">
      <div class="admin-section-title">🎖️ Emitir certificado</div>
      <form id="f-certificado" class="admin-form">
        <label>Título<input name="titulo" required /></label>
        <label>Descrição<textarea name="descricao"></textarea></label>
        <label>Tipo
          <select name="tipo">
            <option value="conquista">🏆 Conquista</option>
            <option value="destaque">⭐ Destaque</option>
            <option value="participacao">📜 Participação</option>
            <option value="menção">🎖️ Menção honrosa</option>
            <option value="personalizado">✏️ Personalizado</option>
          </select>
        </label>
        <label>Matrícula do aluno<input name="matricula" required /></label>
        <label>Nome do aluno<input name="nome" required /></label>
        <label>Turma<input name="turma" /></label>
        <button type="submit" class="admin-btn">🎖️ Emitir</button>
      </form>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">Emitidos (${certificados.length})</div>
      ${certificados.length ? `<div class="admin-list">${certificados.map((c) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">🎖️ ${esc(c.titulo)}</div>
            <div class="admin-item-meta"><strong>${esc(c.aluno_nome)}</strong> (${esc(c.turma || "—")}) — ${fmtData(c.emitido_em)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-cert" data-id="${c.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `<div class="admin-empty">Nenhum certificado</div>`}
    </div>`;
}

function bindCertificados() {
  document.getElementById("f-certificado")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Emitindo...");
    try {
      await api("/api/premios/certificados/emitir", { method: "POST", body: JSON.stringify({
        destinatarios: [{ matricula: fd.get("matricula"), nome: fd.get("nome"), turma: fd.get("turma") }],
        tipo: fd.get("tipo"), titulo: fd.get("titulo"), descricao: fd.get("descricao"),
      })});
      alert("✅ Certificado emitido!");
      carregar("certificados");
    } catch (err) { alert("Erro: " + err.message); esconderLoading(); }
  });
  document.querySelectorAll(".del-cert").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api("/api/premios/certificados/" + b.dataset.id, { method: "DELETE" });
      carregar("certificados"); esconderLoading();
    });
  });
}

/* ============================================================
   BIND CENTRAL
   ============================================================ */
function bind(aba) {
  if (aba === "posts")        bindPosts();
  if (aba === "avisos")       bindAvisos();
  if (aba === "eventos")      bindEventos();
  if (aba === "merenda")      bindMerenda();
  if (aba === "turmas")       bindTurmasAdmin();
  if (aba === "usuarios")     bindUsuarios();
  if (aba === "pedidos")      bindPedidos();
  if (aba === "codigos")      bindCodigos();
  if (aba === "mural")        bindMuralAdmin();
  if (aba === "certificados") bindCertificados();
}

carregar("posts");
