import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

/* ============================================================
   ALUNO LOGADO
   ============================================================ */
let alunoAtual = null;
let boletimCache = null;

const alunoStr = localStorage.getItem("aluno");
if (!alunoStr) window.location.href = "/portal-aluno.html";

try {
  alunoAtual = JSON.parse(alunoStr);
  boletimCache = alunoAtual.boletim || null;
} catch {
  localStorage.removeItem("aluno");
  window.location.href = "/portal-aluno.html";
}

try {
  const me = await api("/api/aluno/me");
  alunoAtual = { ...alunoAtual, ...me };
} catch {
  localStorage.removeItem("aluno");
  window.location.href = "/portal-aluno.html";
}

document.getElementById("user-nome").textContent = alunoAtual.nome;
document.getElementById("user-cargo").textContent = alunoAtual.matricula;
document.getElementById("user-avatar").textContent = (alunoAtual.nome || "A").charAt(0).toUpperCase();

document.getElementById("btn-sair").addEventListener("click", async () => {
  await api("/api/aluno/logout", { method: "POST" }).catch(() => {});
  localStorage.removeItem("aluno");
  window.location.href = "/portal-aluno.html";
});

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const titulos = {
  boletim: ["Boletim", "Suas notas do ano letivo"],
  sala: ["Sala/Atividades", "Atividades postadas pelos professores"],
  "minhas-atividades": ["Minhas entregas", "Suas atividades enviadas"],
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
  const el = document.getElementById("conteudo-aluno");
  mostrarLoading("Carregando...");
  try {
    if (aba === "boletim") {
      if (!boletimCache) boletimCache = await api("/api/aluno/boletim");
      el.innerHTML = renderBoletim(boletimCache);
    }
    if (aba === "sala") {
      el.innerHTML = await renderSala();
      bindSala();
    }
    if (aba === "minhas-atividades") {
      el.innerHTML = await renderMinhasAtividades();
    }
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="admin-section"><p style="color:#c53030">Erro: ${esc(e.message)}</p></div>`;
  } finally {
    esconderLoading();
  }
}

/* ============================================================
   BOLETIM
   ============================================================ */
function renderBoletim(b) {
  if (!b?.disciplinas?.length) {
    return `
      <div class="admin-section">
        <div class="admin-empty">
          <div class="admin-empty-icon">▤</div>
          Nenhuma nota encontrada
        </div>
      </div>`;
  }

  const s = b.situacao || {};
  return `
    <div class="admin-section">
      <div class="admin-section-title">
        Notas por disciplina — ${esc(b.aluno?.nome || alunoAtual.nome)}
      </div>
      <div style="font-size:0.85rem;color:#5a6472;margin-bottom:14px">
        ${esc(b.turma?.turma || "")} • ${esc(b.turma?.serie || "")} • ${esc(b.turma?.turno || "")}
      </div>
      <div class="tabela-wrapper">
        <table class="nao-responsiva">
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>Professor(a)</th>
              <th style="text-align:center">1º</th>
              <th style="text-align:center">2º</th>
              <th style="text-align:center">3º</th>
              <th style="text-align:center">4º</th>
              <th style="text-align:center">Faltas</th>
            </tr>
          </thead>
          <tbody>
            ${b.disciplinas.map((d) => `
              <tr>
                <td>${esc(d.nome)}</td>
                <td style="font-size:0.8rem">${esc(d.professor || "—")}</td>
                <td style="text-align:center" class="${classeNota(d.bim1)}">${esc(d.bim1 || "—")}</td>
                <td style="text-align:center" class="${classeNota(d.bim2)}">${esc(d.bim2 || "—")}</td>
                <td style="text-align:center" class="${classeNota(d.bim3)}">${esc(d.bim3 || "—")}</td>
                <td style="text-align:center" class="${classeNota(d.bim4)}">${esc(d.bim4 || "—")}</td>
                <td style="text-align:center">${esc(d.faltas || "0")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">Resumo da série</div>
      <div class="resumo">
        ${cardResumo(s.status || "—", "Situação")}
        ${cardResumo(s.frequencia || "—", "Frequência")}
        ${cardResumo(s.faltas || "0", "Faltas")}
        ${cardResumo(s.aulasDadas || "0", "Aulas dadas")}
      </div>
    </div>
  `;
}

function classeNota(v) {
  if (!v) return "";
  const n = parseFloat(String(v).replace(",", "."));
  if (isNaN(n)) return "";
  if (n < 6) return "nota-baixa";
  if (n < 7) return "nota-media";
  return "nota-alta";
}

function cardResumo(valor, label) {
  return `
    <div class="resumo-item">
      <div class="valor">${esc(valor)}</div>
      <div class="label">${esc(label)}</div>
    </div>`;
}

/* ============================================================
   SALA / ATIVIDADES (Classroom)
   ============================================================ */
async function renderSala() {
  const turma = alunoAtual.turma || "";
  const atividades = await api(`/api/classroom/atividades?turma=${encodeURIComponent(turma)}`).catch(() => []);

  return `
    <div class="admin-section">
      <div class="admin-section-title">
        📚 Atividades da turma ${turma ? `(${esc(turma)})` : ""}
      </div>
      <div class="classroom-list">
        ${atividades.length ? atividades.map(renderAtividadeAluno).join("") : `
          <div class="admin-empty">
            <div class="admin-empty-icon">◈</div>
            Nenhuma atividade postada ainda
          </div>`}
      </div>
    </div>
  `;
}

function renderAtividadeAluno(a) {
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
            <span class="admin-badge">${esc(a.professor_nome || "Professor")}</span>
            ${fmtData(a.criado_em)}
          </div>
        </div>
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
        💬 <strong id="count-${a.id}">${a.total_comentarios || 0}</strong> comentário(s)
        <button class="classroom-toggle-comentarios" data-id="${a.id}">Ver comentários ▼</button>
      </div>

      <div class="classroom-comentarios" id="comentarios-${a.id}" style="display:none"></div>
    </div>
  `;
}

function bindSala() {
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
        container.innerHTML = `
          ${comentarios.length
            ? comentarios.map((c) => renderComentarioAluno(c, alunoAtual.matricula)).join("")
            : `<div class="classroom-empty">Nenhum comentário ainda. Seja o primeiro!</div>`}
          <div class="comentario-form">
            <textarea id="novo-coment-${id}" placeholder="Escreva um comentário..."></textarea>
            <button class="admin-btn enviar-comentario" data-id="${id}">Enviar</button>
          </div>
        `;
        bindComentario(id);
      } catch (e) {
        container.innerHTML = `<div class="classroom-empty">Erro: ${esc(e.message)}</div>`;
      }
    });
  });
}

function renderComentarioAluno(c, minhaMatricula) {
  const isProfessor = c.autor_tipo === "professor" || c.autor_tipo === "admin";
  const isMeu = c.autor_matricula === minhaMatricula;
  const iniciais = (c.autor_nome || "?").charAt(0).toUpperCase();
  const cor = isProfessor ? "#2a5298" : "#38a169";

  const emojis = ["👍", "❤️", "😂", "🤔", "👏", "🔥"];
  const minhasReacoes = c.reacoes || {};

  return `
    <div class="comentario ${isProfessor ? "comentario-prof" : ""}">
      <div class="comentario-avatar" style="background:${cor}">${iniciais}</div>
      <div class="comentario-body">
        <div class="comentario-header">
          <strong>${esc(c.autor_nome)}</strong>
          ${isProfessor ? '<span class="comentario-tag">Professor(a)</span>' : ""}
          ${isMeu ? '<span class="comentario-tag" style="background:#d1fae5;color:#065f46">Você</span>' : ""}
          <span class="comentario-hora">${fmtData(c.criado_em)}</span>
        </div>
        <div class="comentario-texto">${esc(c.texto)}</div>

        <div class="comentario-reacoes">
          ${emojis.map((e) => {
            const usuarios = minhasReacoes[e] || [];
            const eu = usuarios.includes(minhaMatricula);
            const count = usuarios.length;
            return `
              <button class="reacao-btn ${eu ? "ativa" : ""}"
                      data-comentario="${c.id}"
                      data-emoji="${e}">
                ${e} ${count > 0 ? count : ""}
              </button>`;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

function bindComentario(atividadeId) {
  document.querySelector(`.enviar-comentario[data-id="${atividadeId}"]`)?.addEventListener("click", async (e) => {
    const texto = document.getElementById(`novo-coment-${atividadeId}`).value;
    if (!texto.trim()) return alert("Escreva um comentário");

    mostrarLoading("Enviando...");
    try {
      await api("/api/classroom/comentarios", {
        method: "POST",
        body: JSON.stringify({
          atividade_id: atividadeId,
          texto,
          autor_tipo: "aluno",
          autor_nome: alunoAtual.nome,
          autor_matricula: alunoAtual.matricula,
        }),
      });

      const comentarios = await api(`/api/classroom/atividades/${atividadeId}/comentarios`);
      const container = document.getElementById(`comentarios-${atividadeId}`);
      container.innerHTML = `
        ${comentarios.length
          ? comentarios.map((c) => renderComentarioAluno(c, alunoAtual.matricula)).join("")
          : `<div class="classroom-empty">Nenhum comentário ainda</div>`}
        <div class="comentario-form">
          <textarea id="novo-coment-${atividadeId}" placeholder="Escreva um comentário..."></textarea>
          <button class="admin-btn enviar-comentario" data-id="${atividadeId}">Enviar</button>
        </div>
      `;
      bindComentario(atividadeId);
      document.getElementById(`count-${atividadeId}`).textContent = comentarios.length;
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      esconderLoading();
    }
  });

  document.querySelectorAll(`.reacao-btn[data-comentario]`).forEach((b) => {
    b.addEventListener("click", async () => {
      const comentarioId = b.dataset.comentario;
      const emoji = b.dataset.emoji;

      try {
        await api("/api/classroom/reacoes", {
          method: "POST",
          body: JSON.stringify({
            comentario_id: comentarioId,
            emoji,
            autor_matricula: alunoAtual.matricula,
          }),
        });

        const comentarios = await api(`/api/classroom/atividades/${atividadeId}/comentarios`);
        const container = document.getElementById(`comentarios-${atividadeId}`);
        const textoAtual = document.getElementById(`novo-coment-${atividadeId}`)?.value || "";
        container.innerHTML = `
          ${comentarios.map((c) => renderComentarioAluno(c, alunoAtual.matricula)).join("")}
          <div class="comentario-form">
            <textarea id="novo-coment-${atividadeId}" placeholder="Escreva um comentário...">${esc(textoAtual)}</textarea>
            <button class="admin-btn enviar-comentario" data-id="${atividadeId}">Enviar</button>
          </div>
        `;
        bindComentario(atividadeId);
      } catch (e) {
        console.error(e);
      }
    });
  });
}

/* ============================================================
   MINHAS ATIVIDADES (envios)
   ============================================================ */
async function renderMinhasAtividades() {
  const envios = await api(`/api/atividades/envios/listar?aluno_matricula=${alunoAtual.matricula}`).catch(() => []);

  return `
    <div class="admin-section">
      <div class="admin-section-title">📤 Minhas entregas (${envios.length})</div>
      ${envios.length ? `<div class="admin-list">${envios.map((e) => `
        <div class="admin-item">
          <div class="admin-item-content">
            <div class="admin-item-title">${esc(e.titulo)}</div>
            <div class="admin-item-meta">
              <span class="admin-badge">${esc(e.status)}</span>
              ${esc(e.professor_nome || "")} — ${fmtData(e.criado_em)}
            </div>
            ${e.descricao ? `<div class="admin-item-text">${esc(e.descricao)}</div>` : ""}
            ${e.nota ? `<div style="margin-top:8px"><span class="card-nota ${e.nota >= 7 ? "nota-boa" : e.nota >= 5 ? "nota-media" : "nota-ruim"}">Nota: ${e.nota}</span></div>` : ""}
            ${e.comentario_professor ? `<div style="margin-top:8px;font-style:italic;color:#5a6472">"${esc(e.comentario_professor)}"</div>` : ""}
          </div>
        </div>`).join("")}</div>` : `
        <div class="admin-empty">
          <div class="admin-empty-icon">▦</div>
          Nenhuma entrega ainda
        </div>`}
    </div>
  `;
}

/* ============================================================
   INICIALIZA
   ============================================================ */
carregar("boletim");
