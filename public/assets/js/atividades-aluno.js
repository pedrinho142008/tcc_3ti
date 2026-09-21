import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

const TURMAS = ["1º Ano T.I", "2º Ano T.I", "3º Ano T.I"];
const TIPOS = "image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx";

let atividadesCache = [];
let professoresCache = [];
let enviosCache = [];
let alunoAtual = null;

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
      <div class="admin-section-title">Enviar atividade</div>
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

        <label>Arquivo (foto, vídeo, PDF, Word, PowerPoint)
          <div class="admin-upload-area" id="ua-envio">
            <div id="uc-envio">
              <div class="admin-upload-icon">▣</div>
              <div class="admin-upload-text">Clique pra escolher um arquivo</div>
              <div class="admin-upload-hint">Até 50 MB</div>
            </div>
          </div>
          <input type="file" id="file-envio" accept="${TIPOS}" style="display:none" />
        </label>

        <label>Título da atividade
          <input name="titulo" required placeholder="Ex: Lista de exercícios 3" />
        </label>

        <label>Descrição / nome dos componentes
          <textarea name="descricao" placeholder="Nomes dos integrantes e detalhes..."></textarea>
        </label>

        <button type="submit" class="admin-btn">Enviar atividade</button>
      </form>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Minhas entregas</div>
      <div id="lista-envios">
        ${enviosCache.length
          ? enviosCache.map(renderEnvioAluno).join("")
          : `<div class="admin-empty"><div class="admin-empty-icon">▤</div>Nenhuma entrega ainda</div>`}
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Atividades abertas pra turma</div>
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
  let arquivoMeta = null;

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
      content.innerHTML = `
        <div class="admin-upload-icon">▤</div>
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
      if (!r.ok) throw new Error(data.erro || "Falha no upload");
      arquivoMeta = data;
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      esconderLoading();
    }
  });

  document.getElementById("form-envio")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const sel = e.target.querySelector('[name="professor"]');

    if (!sel.value) return alert("Escolha o professor");
    if (!arquivoMeta) return alert("Escolha um arquivo");

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
      await initAtividades(alunoAtual);
    } catch (err) {
      alert("Erro: " + err.message);
      esconderLoading();
    }
  });
}

function renderEnvioAluno(e) {
  return `
    <div class="admin-item">
      <div class="admin-item-content">
        <div class="admin-item-title">${esc(e.titulo)}</div>
        <div class="admin-item-meta">
          <span class="admin-badge">${esc(e.status)}</span>
          ${esc(e.professor_nome || "")} — ${fmtData(e.criado_em)}
        </div>
        ${e.descricao ? `<div class="admin-item-text">${esc(e.descricao)}</div>` : ""}
        ${e.nota ? `<div style="margin-top:8px"><span class="card-nota ${classeNota(e.nota)}">Nota: ${e.nota}</span></div>` : ""}
        ${e.comentario_professor ? `<div style="margin-top:8px;font-style:italic;color:#5a6472">"${esc(e.comentario_professor)}"</div>` : ""}
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
