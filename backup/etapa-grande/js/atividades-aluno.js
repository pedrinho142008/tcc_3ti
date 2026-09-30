import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

const TURMAS = ["1º Ano A", "1º Ano T.I", "2º Ano A", "2º Ano T.I", "3º Ano A", "3º Ano T.I"];
const TIPOS = "image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx";

let atividadesCache = [];
let professoresCache = [];
let enviosCache = [];
let alunoAtual = null;
let arquivoMeta = null; // GLOBAL — não zera entre renders

export async function initAtividades(aluno) {
  alunoAtual = aluno;
  const el = document.getElementById("conteudo-atividades");
  if (!el) return;

  mostrarLoading("Carregando atividades...");
  try {
    const [atv, profs, env] = await Promise.all([
      api("/api/atividades").catch(() => []),
      api("/api/atividades/professores/lista").catch(() => []),
      api(`/api/atividades/envios/listar?aluno_matricula=${aluno.matricula}`).catch(() => []),
    ]);
    atividadesCache = atv;
    professoresCache = profs;
    enviosCache = env;
    render(el);
  } catch (e) {
    el.innerHTML = `<p style="color:#e53e3e">Erro: ${esc(e.message)}</p>`;
  } finally {
    esconderLoading();
  }
}

function render(el) {
  el.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">📤 Enviar atividade</div>
      <form id="form-envio" class="admin-form">
        <label>Professor(a)
          <select name="professor" required>
            <option value="">Selecione o professor</option>
            ${professoresCache.map((p) => `
              <option value="${p.id}" data-nome="${esc(p.nome)}">
                ${esc(p.nome)} ${p.cargo ? "— " + esc(p.cargo) : ""}
              </option>`).join("")}
          </select>
        </label>

        <label>Turma
          <select name="turma" required>
            <option value="">Selecione a turma</option>
            ${TURMAS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
        </label>

        <label>Arquivo (foto, vídeo, PDF, Word, PowerPoint)</label>
        <div class="admin-upload-area" id="ua-envio" style="border:2px dashed #c7d2e0;border-radius:12px;padding:24px;text-align:center;background:#fafbfc;cursor:pointer;margin-bottom:16px">
          <div id="uc-envio">
            <div style="font-size:1.8rem;color:#8895a7">📎</div>
            <div style="font-size:0.85rem;color:#5a6472;margin-top:6px">Clique pra escolher um arquivo</div>
            <div style="font-size:0.75rem;color:#8895a7;margin-top:4px">Até 50 MB</div>
          </div>
        </div>
        <input type="file" id="file-envio" accept="${TIPOS}" style="display:none" />

        <label>Título da atividade
          <input name="titulo" required placeholder="Ex: Lista de exercícios 3" />
        </label>

        <label>Descrição / nome dos componentes
          <textarea name="descricao" placeholder="Nomes dos integrantes e detalhes..."></textarea>
        </label>

        <button type="submit" class="admin-btn" style="width:100%">Enviar atividade</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">📤 Minhas entregas</div>
      <div id="lista-envios">
        ${enviosCache.length
          ? enviosCache.map(renderEnvioAluno).join("")
          : `<div class="admin-empty"><div class="admin-empty-icon">▤</div>Nenhuma entrega ainda</div>`}
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">📚 Atividades abertas pra turma</div>
      <div class="admin-list">
        ${atividadesCache.length
          ? atividadesCache.map(renderAtividade).join("")
          : `<div class="admin-empty"><div class="admin-empty-icon">◈</div>Nenhuma atividade agendada</div>`}
      </div>
    </div>
  `;

  bind(el);
}

function bind(el) {
  const area = document.getElementById("ua-envio");
  const file = document.getElementById("file-envio");
  const content = document.getElementById("uc-envio");

  // NÃO zera arquivoMeta aqui (senão reseta)

  area?.addEventListener("click", () => file.click());

  file?.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        area.classList.add("has-image");
        content.innerHTML = `<img src="${ev.target.result}" style="max-width:100%;max-height:200px;border-radius:8px" />`;
      };
      reader.readAsDataURL(f);
    } else {
      area.classList.add("has-image");
      content.innerHTML = `
        <div style="font-size:1.8rem">📄</div>
        <div style="font-size:0.85rem;color:#2a5298;font-weight:600;margin-top:6px">${esc(f.name)}</div>
        <div style="font-size:0.75rem;color:#8895a7;margin-top:4px">${(f.size / 1024 / 1024).toFixed(2)} MB</div>`;
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
      if (!r.ok) throw new Error(data.erro || "Falha no upload");
      arquivoMeta = data;
      console.log("✅ Arquivo enviado:", data.url);
    } catch (err) {
      alert("Erro: " + err.message);
      arquivoMeta = null;
    } finally {
      esconderLoading();
    }
  });

  // Botão "Ver o que enviei"
  document.querySelectorAll(".btn-ver-arquivo").forEach((b) => {
    b.addEventListener("click", () => {
      const url = b.dataset.url;
      const tipo = b.dataset.tipo;
      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;inset:0;background:rgba(15,28,56,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
      modal.innerHTML = `
        <div style="background:white;border-radius:20px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;padding:22px;position:relative">
          <button class="fechar" style="position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:none;background:#f5f7fa;cursor:pointer">✕</button>
          <h2 style="color:#1e3c72;font-size:1.1rem;margin:0 0 16px">📎 O que você enviou</h2>
          ${tipo?.startsWith("image/") ? `<img src="${url}" style="width:100%;border-radius:10px;background:#f5f7fa" />` : ""}
          ${tipo?.startsWith("video/") ? `<video src="${url}" controls style="width:100%;border-radius:10px;background:#000"></video>` : ""}
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <a href="${url}" target="_blank" style="padding:10px 16px;background:#2a5298;color:white;border-radius:8px;text-decoration:none;font-size:0.82rem;font-weight:700">🔍 Abrir em nova aba</a>
            <a href="${url}" download style="padding:10px 16px;background:#eef3fb;color:#2a5298;border-radius:8px;text-decoration:none;font-size:0.82rem;font-weight:700">⬇️ Baixar</a>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector(".fechar").onclick = () => modal.remove();
      modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    });
  });

  document.getElementById("form-envio")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const sel = e.target.querySelector('[name="professor"]');

    if (!sel.value) return alert("Escolha o professor");
    if (!arquivoMeta) return alert("Escolha um arquivo primeiro (clique na área tracejada)");

    mostrarLoading("Enviando...");
    try {
      await api("/api/atividades/envios", {
        method: "POST",
        body: JSON.stringify({
          professor_id: sel.value,
          professor_nome: sel.options[sel.selectedIndex].dataset.nome,
          aluno_matricula: alunoAtual.matricula,
          aluno_nome: alunoAtual.nome,
          turma: fd.get("turma"),
          titulo: fd.get("titulo"),
          descricao: fd.get("descricao"),
          arquivo_url: arquivoMeta.url,
          arquivo_tipo: arquivoMeta.tipo,
          arquivo_nome: arquivoMeta.nome,
          arquivo_tamanho: arquivoMeta.tamanho,
        }),
      });
      alert("✅ Atividade enviada!");
      arquivoMeta = null;
      await initAtividades(alunoAtual);
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });
}

function renderEnvioAluno(e) {
  const corrigida = e.status === "corrigido";
  return `
    <div class="admin-item" style="background:${corrigida ? "#f0fdf4" : "#f8fafc"};border-radius:12px;padding:14px">
      <div class="admin-item-content">
        <div class="admin-item-title">${esc(e.titulo)}</div>
        <div class="admin-item-meta">
          <span class="admin-badge">${esc(e.status)}</span>
          ${esc(e.professor_nome || "")} — ${fmtData(e.criado_em)}
        </div>
        ${e.descricao ? `<div class="admin-item-text">${esc(e.descricao)}</div>` : ""}

        ${e.arquivo_url ? `
          <div style="margin-top:10px">
            <button class="btn-ver-arquivo" data-url="${esc(e.arquivo_url)}" data-tipo="${esc(e.arquivo_tipo || "")}"
              style="padding:8px 14px;background:#eef3fb;color:#2a5298;border:none;border-radius:8px;font-family:inherit;font-size:0.78rem;font-weight:700;cursor:pointer">
              🔍 Ver o que enviei
            </button>
          </div>
        ` : ""}

        ${e.nota !== null && e.nota !== undefined ? `
          <div style="margin-top:10px;padding:10px;background:white;border-radius:10px">
            <div style="font-size:0.7rem;color:#065f46;font-weight:700;text-transform:uppercase">✅ Corrigido</div>
            <div style="font-size:1.2rem;font-weight:900;color:${e.nota >= 7 ? "#38a169" : e.nota >= 5 ? "#ed8936" : "#e53e3e"};margin-top:4px">${e.nota}</div>
            ${e.comentario_professor ? `<div style="font-size:0.82rem;color:#4a5568;margin-top:4px;font-style:italic">"${esc(e.comentario_professor)}"</div>` : ""}
          </div>
        ` : ""}
      </div>
    </div>`;
}

function renderAtividade(a) {
  const prazo = a.prazo ? new Date(a.prazo) : null;
  const dias = prazo ? Math.ceil((prazo - new Date()) / 86400000) : null;
  let cor = "#38a169";
  if (dias !== null) {
    if (dias < 0) cor = "#e53e3e";
    else if (dias <= 2) cor = "#ed8936";
  }

  return `
    <div class="admin-item">
      <div class="admin-item-content">
        <div class="admin-item-title">${esc(a.titulo)}</div>
        <div class="admin-item-meta">
          <span class="admin-badge">${esc(a.turma)}</span>
          ${esc(a.professor_nome || "")}
        </div>
        ${a.descricao ? `<div class="admin-item-text">${esc(a.descricao)}</div>` : ""}
        ${prazo ? `<div style="margin-top:10px;display:inline-block;padding:6px 10px;border-radius:8px;background:${cor}20;color:${cor};font-size:0.75rem;font-weight:700">
          Prazo: ${prazo.toLocaleDateString("pt-BR")} ${dias >= 0 ? `(${dias} dias)` : "(expirado)"}
        </div>` : ""}
        ${a.arquivo_url ? `<a href="${esc(a.arquivo_url)}" target="_blank" style="display:inline-block;margin-top:8px;font-size:0.8rem;color:#2a5298;font-weight:600">📎 Ver arquivo</a>` : ""}
      </div>
    </div>`;
}

function classeNota(n) {
  if (n >= 7) return "nota-boa";
  if (n >= 5) return "nota-media";
  return "nota-ruim";
}
