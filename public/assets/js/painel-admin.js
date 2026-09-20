import { api, esc, fmtData, fmtCurta, mostrarLoading, esconderLoading, periodoNome } from "/assets/js/shared.js";

let user = null;
try {
  user = await api("/api/users/me");
} catch {
  window.location.href = "/login.html";
}

// Preenche dados do usuário
document.getElementById("user-nome").textContent = user.nome || "—";
document.getElementById("user-cargo").textContent = user.cargo || user.tipo;
document.getElementById("user-avatar").textContent = (user.nome || "A").charAt(0).toUpperCase();

document.getElementById("btn-sair").addEventListener("click", async () => {
  await api("/api/users/logout", { method: "POST" });
  window.location.href = "/";
});

// Abas
const titulos = {
  posts: ["Postagens", "Gerencie as publicações do site"],
  avisos: ["Avisos", "Comunicados rápidos pra toda a comunidade"],
  eventos: ["Eventos", "Agenda escolar"],
  merenda: ["Merenda", "Cardápio diário"],
  usuarios: ["Usuários", "Funcionários e administradores"],
};

document.querySelectorAll(".admin-nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-item").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    const aba = btn.dataset.aba;
    document.getElementById("admin-titulo").textContent = titulos[aba][0];
    document.getElementById("admin-sub").textContent = titulos[aba][1];
    carregar(aba);
  });
});

let abaAtual = "posts";

async function carregar(aba) {
  abaAtual = aba;
  const el = document.getElementById("admin-conteudo");
  mostrarLoading();
  try {
    el.innerHTML = await render(aba);
    bind(aba);
  } catch (e) {
    el.innerHTML = `<div class="admin-section"><p style="color:#c53030">Erro: ${esc(e.message)}</p></div>`;
  } finally {
    esconderLoading();
  }
}

/* ---------- FORM DE IMAGEM (upload + URL) ---------- */
function formImagem(idCampo) {
  return `
    <div class="admin-form">
      <label>Imagem
        <div class="admin-upload-area" id="upload-area-${idCampo}">
          <div id="upload-content-${idCampo}">
            <div class="admin-upload-icon">▣</div>
            <div class="admin-upload-text">Clique pra escolher uma foto do dispositivo</div>
            <div class="admin-upload-hint">JPG, PNG ou WEBP — até 5 MB</div>
          </div>
          <input type="file" id="file-${idCampo}" accept="image/*" style="display:none" />
        </div>
      </label>

      <div class="admin-upload-or">ou</div>

      <label>URL da imagem
        <input type="text" id="url-${idCampo}" placeholder="https://exemplo.com/foto.jpg" />
      </label>
    </div>
  `;
}

function bindImagem(idCampo) {
  const area = document.getElementById(`upload-area-${idCampo}`);
  const file = document.getElementById(`file-${idCampo}`);
  const url = document.getElementById(`url-${idCampo}`);
  const content = document.getElementById(`upload-content-${idCampo}`);

  if (!area) return;

  area.addEventListener("click", () => file.click());

  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = (e) => {
      area.classList.add("has-image");
      content.innerHTML = `<img class="admin-upload-preview" src="${e.target.result}" />`;
    };
    reader.readAsDataURL(f);

    // Upload pro Supabase
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
      url.value = data.url;
    } catch (err) {
      alert("Erro ao subir imagem: " + err.message);
      area.classList.remove("has-image");
      content.innerHTML = `<div class="admin-upload-icon">▣</div>
        <div class="admin-upload-text">Clique pra escolher uma foto</div>`;
    } finally {
      esconderLoading();
    }
  });

  url.addEventListener("input", () => {
    const v = url.value.trim();
    if (v && /^https?:\/\//.test(v)) {
      area.classList.add("has-image");
      content.innerHTML = `<img class="admin-upload-preview" src="${esc(v)}" onerror="this.style.display='none'" />`;
    } else {
      area.classList.remove("has-image");
      content.innerHTML = `<div class="admin-upload-icon">▣</div>
        <div class="admin-upload-text">Clique pra escolher uma foto</div>`;
    }
  });
}

/* ---------- POSTS ---------- */
async function renderPosts() {
  const posts = await api("/api/posts");
  return `
    <div class="admin-section">
      <div class="admin-section-title">Nova postagem</div>
      <form id="f-post" class="admin-form">
        <label>Título
          <input name="titulo" required placeholder="Ex: Semana da leitura" />
        </label>
        <label>Texto
          <textarea name="texto" required placeholder="Conteúdo da postagem..."></textarea>
        </label>

        ${formImagem("post")}

        <label>Categoria
          <select name="categoria">
            <option value="noticia">Notícia</option>
            <option value="evento">Evento</option>
            <option value="aviso">Aviso</option>
            <option value="conquista">Conquista</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:normal;font-weight:500">
          <input type="checkbox" name="fixada" style="width:auto;margin:0" />
          Fixar no topo da home
        </label>
        <button type="submit" class="admin-btn">Publicar postagem</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Postagens existentes (${posts.length})</div>
      ${posts.length ? `<div class="admin-list">${posts.map((p) => `
        <div class="admin-item">
          <div class="admin-item-content">
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
  bindImagem("post");

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
          imagem_url: document.getElementById("url-post").value || null,
          categoria: fd.get("categoria"),
          fixada: fd.get("fixada") === "on",
        }),
      });
      carregar("posts");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });

  document.querySelectorAll(".del-post").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir esta postagem?")) return;
      mostrarLoading();
      await api("/api/posts/" + b.dataset.id, { method: "DELETE" });
      carregar("posts");
    });
  });
}

/* ---------- AVISOS ---------- */
async function renderAvisos() {
  const avisos = await api("/api/announcements");
  return `
    <div class="admin-section">
      <div class="admin-section-title">Novo aviso</div>
      <form id="f-aviso" class="admin-form">
        <label>Texto do aviso
          <textarea name="texto" required placeholder="Comunicado rápido..."></textarea>
        </label>
        <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:normal;font-weight:500">
          <input type="checkbox" name="urgente" style="width:auto;margin:0" />
          Marcar como urgente
        </label>
        <button type="submit" class="admin-btn">Publicar aviso</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Avisos ativos (${avisos.length})</div>
      ${avisos.length ? `<div class="admin-list">${avisos.map((a) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">
              <span class="admin-badge ${a.urgente ? "urgente" : ""}">${a.urgente ? "Urgente" : "Normal"}</span>
            </div>
            <div class="admin-item-text">${esc(a.texto)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-aviso" data-id="${a.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `
        <div class="admin-empty">
          <div class="admin-empty-icon">◈</div>
          Nenhum aviso ativo
        </div>`}
    </div>
  `;
}

function bindAvisos() {
  document.getElementById("f-aviso")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          texto: fd.get("texto"),
          urgente: fd.get("urgente") === "on",
        }),
      });
      carregar("avisos");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });

  document.querySelectorAll(".del-aviso").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir aviso?")) return;
      mostrarLoading();
      await api("/api/announcements/" + b.dataset.id, { method: "DELETE" });
      carregar("avisos");
    });
  });
}

/* ---------- EVENTOS ---------- */
async function renderEventos() {
  const evs = await api("/api/events");
  return `
    <div class="admin-section">
      <div class="admin-section-title">Novo evento</div>
      <form id="f-evento" class="admin-form">
        <label>Título
          <input name="titulo" required />
        </label>
        <label>Descrição
          <textarea name="descricao"></textarea>
        </label>
        <label>Local
          <input name="local" placeholder="Ex: Quadra da escola" />
        </label>
        <label>Início
          <input type="datetime-local" name="data_inicio" required />
        </label>
        <label>Fim
          <input type="datetime-local" name="data_fim" />
        </label>

        ${formImagem("evento")}

        <button type="submit" class="admin-btn">Criar evento</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Eventos cadastrados (${evs.length})</div>
      ${evs.length ? `<div class="admin-list">${evs.map((e) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(e.titulo)}</div>
            <div class="admin-item-meta">${fmtData(e.data_inicio)}${e.local ? " — " + esc(e.local) : ""}</div>
            ${e.descricao ? `<div class="admin-item-text">${esc(e.descricao)}</div>` : ""}
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-evento" data-id="${e.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `
        <div class="admin-empty">
          <div class="admin-empty-icon">▦</div>
          Nenhum evento cadastrado
        </div>`}
    </div>
  `;
}

function bindEventos() {
  bindImagem("evento");

  document.getElementById("f-evento")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          titulo: fd.get("titulo"),
          descricao: fd.get("descricao"),
          local: fd.get("local"),
          data_inicio: new Date(fd.get("data_inicio")).toISOString(),
          data_fim: fd.get("data_fim") ? new Date(fd.get("data_fim")).toISOString() : null,
          imagem_url: document.getElementById("url-evento").value || null,
        }),
      });
      carregar("eventos");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });

  document.querySelectorAll(".del-evento").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir evento?")) return;
      mostrarLoading();
      await api("/api/events/" + b.dataset.id, { method: "DELETE" });
      carregar("eventos");
    });
  });
}

/* ---------- MERENDA ---------- */
async function renderMerenda() {
  const ms = await api("/api/meals");
  return `
    <div class="admin-section">
      <div class="admin-section-title">Cadastrar merenda</div>
      <form id="f-merenda" class="admin-form">
        <label>Data
          <input type="date" name="data" required />
        </label>
        <label>Período
          <select name="periodo" required>
            <option value="manha">Manhã</option>
            <option value="almoco">Almoço</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
          </select>
        </label>
        <label>Descrição
          <textarea name="descricao" required placeholder="Ex: Arroz, feijão, frango grelhado e salada"></textarea>
        </label>
        <button type="submit" class="admin-btn">Salvar merenda</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Merenda cadastrada (${ms.length})</div>
      ${ms.length ? `<div class="admin-list">${ms.map((m) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(m.descricao)}</div>
            <div class="admin-item-meta">${fmtData(m.data)} — ${periodoNome(m.periodo)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-merenda" data-id="${m.id}">Excluir</button>
          </div>
        </div>`).join("")}</div>` : `
        <div class="admin-empty">
          <div class="admin-empty-icon">◐</div>
          Nenhuma merenda cadastrada
        </div>`}
    </div>
  `;
}

function bindMerenda() {
  document.getElementById("f-merenda")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/meals", {
        method: "POST",
        body: JSON.stringify({
          data: fd.get("data"),
          periodo: fd.get("periodo"),
          descricao: fd.get("descricao"),
        }),
      });
      carregar("merenda");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });

  document.querySelectorAll(".del-merenda").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api("/api/meals/" + b.dataset.id, { method: "DELETE" });
      carregar("merenda");
    });
  });
}

/* ---------- USUÁRIOS ---------- */
async function renderUsuarios() {
  const us = await api("/api/users");
  return `
    <div class="admin-section">
      <div class="admin-section-title">Novo usuário</div>
      <form id="f-user" class="admin-form">
        <label>Nome
          <input name="nome" required />
        </label>
        <label>Email
          <input type="email" name="email" required />
        </label>
        <label>Senha
          <input type="password" name="senha" required />
        </label>
        <label>Tipo
          <select name="tipo">
            <option value="funcionario">Funcionário</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label>Cargo
          <input name="cargo" placeholder="Ex: Merendeira, Coordenador" />
        </label>
        <button type="submit" class="admin-btn">Criar usuário</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Usuários (${us.length})</div>
      ${us.length ? `<div class="admin-list">${us.map((u) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(u.nome)}</div>
            <div class="admin-item-meta">
              <span class="admin-badge">${u.tipo}</span>
              ${esc(u.cargo || "—")} — ${esc(u.email)}
            </div>
          </div>
        </div>`).join("")}</div>` : `
        <div class="admin-empty">
          <div class="admin-empty-icon">◇</div>
          Nenhum usuário
        </div>`}
    </div>
  `;
}

function bindUsuarios() {
  document.getElementById("f-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading();
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          nome: fd.get("nome"),
          email: fd.get("email"),
          senha: fd.get("senha"),
          tipo: fd.get("tipo"),
          cargo: fd.get("cargo"),
        }),
      });
      carregar("usuarios");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });
}

/* ---------- ROUTER ---------- */
function bind(aba) {
  if (aba === "posts") bindPosts();
  if (aba === "avisos") bindAvisos();
  if (aba === "eventos") bindEventos();
  if (aba === "merenda") bindMerenda();
  if (aba === "usuarios") bindUsuarios();
}

carregar("posts");
