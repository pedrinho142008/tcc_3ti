import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

const TURMAS = ["1º Ano T.I", "2º Ano T.I", "3º Ano T.I"];

let user = null;
try {
  user = await api("/api/users/me");
} catch {
  window.location.href = "/login.html";
}

document.getElementById("user-nome").textContent = user.nome;
document.getElementById("user-cargo").textContent = user.cargo || user.tipo;
document.getElementById("user-avatar").textContent = (user.nome || "P").charAt(0).toUpperCase();

document.getElementById("btn-sair").addEventListener("click", async () => {
  await api("/api/users/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/";
});

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const titulos = {
  atividades: ["Sala/Atividades", "Poste atividades pra sua turma"],
  entregas: ["Entregas dos alunos", "Veja o que os alunos enviaram"],
};

document.querySelectorAll(".admin-nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-item").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    const aba = btn.dataset.aba;
    document.getElementById("titulo-aba").textContent = titulos[aba][0];
    document.getElementById("sub-aba").textContent = titulos[aba][1];
    carregar(aba);
  });
});

/* ============================================================
   ROUTER
   ============================================================ */
async function carregar(aba) {
  const el = document.getElementById("conteudo-prof");
  mostrarLoading("Carregando...");
  try {
    if (aba === "atividades") {
      el.innerHTML = await renderAtividades();
      bindAtividades();
    }
    if (aba === "entregas") {
      el.innerHTML = await renderEntregas();
      bindEntregas();
    }
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="admin-section"><p style="color:#c53030">Erro: ${esc(e.message)}</p></div>`;
  } finally {
    esconderLoading();
  }
}

/* ============================================================
   ABA: ATIVIDADES (postar)
   ============================================================ */
async function renderAtividades() {
  const atividades = await api("/api/classroom/minhas-atividades").catch(() => []);

  return `
    <div class="admin-section">
      <div class="admin-section-title">➕ Nova atividade</div>
      <form id="f-atividade" class="admin-form">
        <label>Título
          <input name="titulo" required placeholder="Ex: Lista de exercícios 3" />
        </label>

        <label>Turma
          <select name="turma" required>
            <option value="">Selecione a turma</option>
            ${TURMAS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
        </label>

        <label>Descrição
          <textarea name="descricao" placeholder="Detalhes da atividade, instruções, etc..."></textarea>
        </label>

        <label>Prazo (opcional)
          <input type="datetime-local" name="prazo" />
        </label>

        <label>Anexo (opcional)
          <div class="admin-upload-area" id="ua-atv">
            <div id="uc-atv">
              <div class="admin-upload-icon">▣</div>
              <div class="admin-upload-text">Clique pra anexar um arquivo</div>
              <div class="admin-upload-hint">PDF, imagem, vídeo, doc... até 50 MB</div>
            </div>
          </div>
          <input type="file" id="file-atv" accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx" style="display:none" />
        </label>

        <button type="submit" class="admin-btn">Postar atividade</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">📋 Atividades postadas (${atividades.length})</div>
      <div class="classroom-list">
        ${atividades.length ? atividades.map(renderAtividadeCard).join("") : `
          <div class="admin-empty">
            <div class="admin-empty-icon">◈</div>
            Nenhuma atividade postada ainda
          </div>`}
      </div>
    </div>
  `;
}

function renderAtividadeCard(a) {
  const prazo = a.prazo ? new Date(a.prazo) : null;
  const dias = prazo ? Math.ceil((prazo - new Date()) / 86400000) : null;

  let cor = "#38a169";
  if (dias !== null) {
    if (dias < 0) cor = "#e53e3e";
    else if (dias <= 2) cor = "#ed8936";
  }

  return `
    <div class="classroom-item" data-id="${a.id}">
      <div class="classroom-item-header">
        <div>
          <div class="classroom-item-title">${esc(a.titulo)}</div>
          <div class="classroom-item-meta">
            <span class="admin-badge">${esc(a.turma)}</span>
            ${fmtData(a.criado_em)}
          </div>
        </div>
        <button class="admin-btn admin-btn-danger admin-btn-sm del-atv" data-id="${a.id}">Excluir</button>
      </div>

      ${a.descricao ? `<div class="classroom-item-text">${esc(a.descricao)}</div>` : ""}

      ${a.arquivo_url ? `
        <a href="${esc(a.arquivo_url)}" target="_blank" class="classroom-anexo">
          📎 ${esc(a.arquivo_nome || "Ver anexo")}
        </a>` : ""}

      ${prazo ? `
        <div class="classroom-prazo" style="background:${cor}20;color:${cor}">
          Prazo: ${prazo.toLocaleString("pt-BR")} ${dias >= 0 ? `(${dias} dias)` : "(expirado)"}
        </div>` : ""}

      <div class="classroom-comentarios-header">
        💬 <strong>${a.total_comentarios || 0}</strong> comentário(s)
        <button class="classroom-toggle-comentarios" data-id="${a.id}">Ver comentários ▼</button>
      </div>

      <div class="classroom-comentarios" id="comentarios-${a.id}" style="display:none"></div>
    </div>
  `;
}

function bindAtividades() {
  // Upload
  const area = document.getElementById("ua-atv");
  const file = document.getElementById("file-atv");
  const content = document.getElementById("uc-atv");
  let arquivoMeta = null;

  area.addEventListener("click", () => file.click());

  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        area.classList.add("has-image");
        content.innerHTML = `<img class="admin-upload-preview" src="${e.target.result}" />`;
      };
      reader.readAsDataURL(f);
    } else {
      area.classList.add("has-image");
      content.innerHTML = `<div class="admin-upload-icon">▤</div>
        <div class="admin-upload-text">${esc(f.name)}</div>
        <div class="admin-upload-hint">${(f.size / 1024 / 1024).toFixed(2)} MB</div>`;
    }

    mostrarLoading("Enviando anexo...");
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      const r = await fetch("/api/classroom/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro);
      arquivoMeta = data;
    } catch (e) {
      alert("Erro no upload: " + e.message);
    } finally {
      esconderLoading();
    }
  });

  // Submit
  document.getElementById("f-atividade")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    mostrarLoading("Postando...");
    try {
      await api("/api/classroom/atividades", {
        method: "POST",
        body: JSON.stringify({
          titulo: fd.get("titulo"),
          descricao: fd.get("descricao"),
          turma: fd.get("turma"),
          prazo: fd.get("prazo") ? new Date(fd.get("prazo")).toISOString() : null,
          arquivo_url: arquivoMeta?.url || null,
          arquivo_tipo: arquivoMeta?.tipo || null,
          arquivo_nome: arquivoMeta?.nome || null,
        }),
      });
      alert("✅ Atividade postada!");
      carregar("atividades");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });

  // Excluir
  document.querySelectorAll(".del-atv").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir esta atividade?")) return;
      mostrarLoading("Excluindo...");
      await api("/api/classroom/atividades/" + b.dataset.id, { method: "DELETE" });
      carregar("atividades");
    });
  });

  // Ver comentários
  document.querySelectorAll(".classroom-toggle-comentarios").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const container = document.getElementById(`comentarios-${id}`);
      const aberto = container.style.display !== "none";

      if (aberto) {
        container.style.display = "none";
        b.textContent = "Ver comentários ▼";
        return;
      }

      container.style.display = "block";
      b.textContent = "Ocultar comentários ▲";
      container.innerHTML = `<div class="classroom-loading">Carregando...</div>`;

      try {
        const comentarios = await api(`/api/classroom/atividades/${id}/comentarios`);
        container.innerHTML = comentarios.length
          ? comentarios.map(renderComentario).join("")
          : `<div class="classroom-empty">Nenhum comentário ainda</div>`;
      } catch (e) {
        container.innerHTML = `<div class="classroom-empty">Erro: ${esc(e.message)}</div>`;
      }
    });
  });
}

function renderComentario(c) {
  const isProfessor = c.autor_tipo === "professor" || c.autor_tipo === "admin";
  const iniciais = (c.autor_nome || "?").charAt(0).toUpperCase();
  const cor = isProfessor ? "#2a5298" : "#38a169";

  return `
    <div class="comentario ${isProfessor ? "comentario-prof" : ""}">
      <div class="comentario-avatar" style="background:${cor}">${iniciais}</div>
      <div class="comentario-body">
        <div class="comentario-header">
          <strong>${esc(c.autor_nome)}</strong>
          ${isProfessor ? '<span class="comentario-tag">Professor(a)</span>' : ""}
          <span class="comentario-hora">${fmtData(c.criado_em)}</span>
        </div>
        <div class="comentario-texto">${esc(c.texto)}</div>
      </div>
    </div>
  `;
}

/* ============================================================
   ABA: ENTREGAS DOS ALUNOS
   ============================================================ */
async function renderEntregas() {
  const envios = await api("/api/atividades/envios/listar").catch(() => []);

  return `
    <div class="admin-section">
      <div class="admin-section-title">📥 Entregas recebidas (${envios.length})</div>
      ${envios.length ? `<div class="admin-list">${envios.map((e) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(e.titulo)}</div>
            <div class="admin-item-meta">
              <span class="admin-badge">${esc(e.turma)}</span>
              ${esc(e.aluno_nome)} — ${fmtData(e.criado_em)}
            </div>
            ${e.descricao ? `<div class="admin-item-text">${esc(e.descricao)}</div>` : ""}
            ${e.arquivo_url ? `<a href="${esc(e.arquivo_url)}" target="_blank" class="classroom-anexo">📎 ${esc(e.arquivo_nome || "Ver arquivo")}</a>` : ""}
          </div>
        </div>`).join("")}</div>` : `
        <div class="admin-empty"><div class="admin-empty-icon">▤</div>Nenhuma entrega recebida</div>`}
    </div>
  `;
}

function bindEntregas() {
  // Sem ações especiais
}

/* ============================================================
   INICIALIZA
   ============================================================ */
carregar("atividades");
