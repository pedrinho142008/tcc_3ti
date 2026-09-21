import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

const TURMAS = ["1º Ano T.I", "2º Ano T.I", "3º Ano T.I"];
const TIPOS = "video/*,application/pdf,image/*,.doc,.docx,.ppt,.pptx";

let user = null;
try {
  user = await api("/api/users/me");
} catch {
  window.location.href = "/login.html";
}

document.getElementById("user-nome").textContent = user.nome;
document.getElementById("user-cargo").textContent = user.cargo || user.tipo;
document.getElementById("user-avatar").textContent = (user.nome || "P").charAt(0);

document.getElementById("btn-sair").addEventListener("click", async () => {
  await api("/api/users/logout", { method: "POST" });
  window.location.href = "/";
});

const titulos = {
  agendar: ["Agendar atividade", "Crie uma atividade com prazo e anexo"],
  receber: ["Receber atividades", "Veja o que os alunos enviaram"],
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

async function carregar(aba) {
  const el = document.getElementById("conteudo-prof");
  mostrarLoading();
  try {
    if (aba === "agendar") {
      el.innerHTML = renderAgendar();
      await bindAgendar();
    }
    if (aba === "receber") {
      el.innerHTML = await renderReceber();
      bindReceber();
    }
  } catch (e) {
    el.innerHTML = `<div class="admin-section"><p style="color:#c53030">Erro: ${esc(e.message)}</p></div>`;
  } finally {
    esconderLoading();
  }
}

function renderAgendar() {
  return `
    <div class="admin-section">
      <div class="admin-section-title">Nova atividade</div>
      <form id="f-atv" class="admin-form">
        <label>Título
          <input name="titulo" required placeholder="Ex: Apresentação sobre algoritmos" />
        </label>
        <label>Turma
          <select name="turma" required>
            <option value="">Selecione</option>
            ${TURMAS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
        </label>
        <label>Descrição
          <textarea name="descricao" placeholder="Detalhes da atividade..."></textarea>
        </label>
        <label>Prazo (data e hora)
          <input type="datetime-local" name="prazo" required />
        </label>
        <label>Arquivo (vídeo, PDF, slides, imagem)
          <div class="admin-upload-area" id="ua-atv">
            <div id="uc-atv">
              <div class="admin-upload-icon">▣</div>
              <div class="admin-upload-text">Clique pra escolher um arquivo</div>
              <div class="admin-upload-hint">Até 50 MB</div>
            </div>
          </div>
          <input type="file" id="file-atv" accept="${TIPOS}" style="display:none" />
        </label>
        <button type="submit" class="admin-btn">Agendar atividade</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Atividades agendadas</div>
      <div id="lista-atv" class="admin-list"></div>
    </div>
  `;
}

async function bindAgendar() {
  const area = document.getElementById("ua-atv");
  const file = document.getElementById("file-atv");
  const content = document.getElementById("uc-atv");
  let meta = null;

  const atvs = await api("/api/atividades").catch(() => []);
  document.getElementById("lista-atv").innerHTML = atvs.length
    ? atvs.map((a) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(a.titulo)}</div>
            <div class="admin-item-meta">
              <span class="admin-badge">${esc(a.turma)}</span>
              ${a.prazo ? "Prazo: " + fmtData(a.prazo) : ""}
            </div>
            ${a.descricao ? `<div class="admin-item-text">${esc(a.descricao)}</div>` : ""}
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn-danger admin-btn-sm del-atv" data-id="${a.id}">Excluir</button>
          </div>
        </div>`).join("")
    : `<div class="admin-empty"><div class="admin-empty-icon">◈</div>Nenhuma atividade agendada</div>`;

  document.querySelectorAll(".del-atv").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api("/api/atividades/" + b.dataset.id, { method: "DELETE" });
      carregar("agendar");
    });
  });

  area.addEventListener("click", () => file.click());

  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        area.classList.add("has-image");
        content.innerHTML = `<img class="admin-upload-preview" src="${ev.target.result}" />`;
      };
      reader.readAsDataURL(f);
    } else {
      area.classList.add("has-image");
      content.innerHTML = `<div class="admin-upload-icon">▤</div>
        <div class="admin-upload-text">${esc(f.name)}</div>
        <div class="admin-upload-hint">${(f.size / 1024 / 1024).toFixed(2)} MB</div>`;
    }

    mostrarLoading("Enviando arquivo...");
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      const r = await fetch("/api/atividades/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro);
      meta = data;
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      esconderLoading();
    }
  });

  document.getElementById("f-atv")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Agendando...");
    try {
      await api("/api/atividades", {
        method: "POST",
        body: JSON.stringify({
          titulo: fd.get("titulo"),
          descricao: fd.get("descricao"),
          turma: fd.get("turma"),
          prazo: new Date(fd.get("prazo")).toISOString(),
          arquivo_url: meta?.url || null,
          arquivo_tipo: meta?.tipo || null,
        }),
      });
      carregar("agendar");
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });
}

async function renderReceber() {
  const envios = await api("/api/atividades/envios/listar").catch(() => []);
  const turmas = [...new Set(envios.map((e) => e.turma))];

  return `
    <div class="admin-section">
      <div class="admin-section-title">Filtrar por turma</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="admin-btn admin-btn-sec filtro-t" data-t="">Todas</button>
        ${turmas.map((t) => `<button class="admin-btn admin-btn-sec filtro-t" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Envios recebidos (${envios.length})</div>
      <div id="lista-env" class="admin-list">
        ${envios.length ? envios.map(renderEnvioProf).join("") : `
          <div class="admin-empty"><div class="admin-empty-icon">▤</div>Nenhum envio recebido</div>`}
      </div>
    </div>
  `;
}

function renderEnvioProf(e) {
  return `
    <div class="admin-item" data-turma="${esc(e.turma)}">
      <div class="admin-item-content">
        <div class="admin-item-title">${esc(e.titulo)}</div>
        <div class="admin-item-meta">
          <span class="admin-badge">${esc(e.turma)}</span>
          ${esc(e.aluno_nome)} (${esc(e.aluno_matricula)}) — ${fmtData(e.criado_em)}
        </div>
        ${e.descricao ? `<div class="admin-item-text">${esc(e.descricao)}</div>` : ""}
        ${e.arquivo_url ? `
          <div style="margin-top:12px;padding:12px;background:#f5f7fa;border-radius:10px">
            <div style="font-size:0.78rem;color:#5a6472;margin-bottom:6px">📎 ${esc(e.arquivo_nome || "arquivo")}</div>
            ${previewArquivo(e.arquivo_url, e.arquivo_tipo)}
          </div>` : ""}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input type="number" class="nota-input" data-id="${e.id}" placeholder="Nota" step="0.1" min="0" max="10"
            value="${e.nota || ""}" style="width:90px;padding:8px;border-radius:8px;border:1px solid #e6e9ef" />
          <input type="text" class="com-input" data-id="${e.id}" placeholder="Comentário"
            value="${esc(e.comentario_professor || "")}" style="flex:1;min-width:150px;padding:8px;border-radius:8px;border:1px solid #e6e9ef" />
          <button class="admin-btn admin-btn-sm salvar-correcao" data-id="${e.id}">Salvar</button>
        </div>
        ${e.status === "corrigido" ? `<div style="margin-top:8px"><span class="card-nota ${e.nota >= 7 ? "nota-boa" : e.nota >= 5 ? "nota-media" : "nota-ruim"}">Corrigido — nota ${e.nota}</span></div>` : ""}
      </div>
    </div>`;
}

function previewArquivo(url, tipo) {
  if (!url) return "";
  const t = (tipo || "").toLowerCase();

  if (t.startsWith("image/")) {
    return `<img class="preview-arquivo" src="${esc(url)}" loading="lazy" />`;
  }
  if (t.startsWith("video/")) {
    return `<video class="preview-arquivo" controls src="${esc(url)}"></video>`;
  }
  if (t === "application/pdf") {
    return `<iframe class="preview-arquivo embed" src="${esc(url)}"></iframe>`;
  }
  return `
    <div style="padding:14px;background:white;border-radius:10px;text-align:center">
      <div style="font-size:1.6rem">📄</div>
      <a href="${esc(url)}" target="_blank" style="color:#2a5298;font-weight:600;font-size:0.85rem">Abrir arquivo</a>
    </div>`;
}

function bindReceber() {
  document.querySelectorAll(".filtro-t").forEach((b) => {
    b.addEventListener("click", () => {
      const t = b.dataset.t;
      document.querySelectorAll(".admin-item").forEach((item) => {
        item.style.display = (!t || item.dataset.turma === t) ? "flex" : "none";
      });
    });
  });

  document.querySelectorAll(".salvar-correcao").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const nota = document.querySelector(`.nota-input[data-id="${id}"]`).value;
      const comentario = document.querySelector(`.com-input[data-id="${id}"]`).value;

      mostrarLoading("Salvando correção...");
      try {
        await api(`/api/atividades/envios/${id}/corrigir`, {
          method: "PUT",
          body: JSON.stringify({ nota: parseFloat(nota), comentario_professor: comentario }),
        });
        alert("✅ Correção salva!");
        carregar("receber");
      } catch (err) {
        alert("Erro: " + err.message);
        esconderLoading();
      }
    });
  });
}

carregar("agendar");
