const API = "/api/insights";

const MEDALHAS = ["🥇", "🥈", "🥉"];

let alunoAtual = null;
try {
  const s = localStorage.getItem("aluno");
  if (s) alunoAtual = JSON.parse(s);
} catch {}

document.querySelector(".menu-btn")?.addEventListener("click", () => {
  document.querySelector(".nav-links")?.classList.toggle("open");
});

document.querySelectorAll(".aba-gami").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".aba-gami").forEach((x) => x.classList.remove("ativa"));
    b.classList.add("ativa");
    carregarAba(b.dataset.aba);
  });
});

async function carregarAba(aba) {
  const el = document.getElementById("conteudo-gami");
  el.innerHTML = `<div class="gami-empty"><div class="ic">⏳</div>Carregando...</div>`;

  try {
    if (aba === "alunos") el.innerHTML = await renderAlunos();
    if (aba === "turmas") el.innerHTML = await renderTurmas();
    if (aba === "conquistas") el.innerHTML = await renderConquistas();
  } catch (e) {
    el.innerHTML = `<div class="gami-empty"><div class="ic">⚠️</div>Erro: ${e.message}</div>`;
  }
}

/* ============================================================
   ABA ALUNOS
   ============================================================ */
async function renderAlunos() {
  const ranking = await fetch(`${API}/gamificacao/ranking?limite=100`).then((r) => r.json());

  if (!ranking.length) {
    return `
      <div class="gami-empty">
        <div class="ic">🏆</div>
        Nenhum aluno no ranking ainda.<br>
        <small>Os pontos aparecem quando os alunos entregam atividades.</small>
      </div>`;
  }

  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  const podium = `
    <div class="podium">
      ${top3[2] ? renderPodium(top3[2], 3) : ""}
      ${top3[0] ? renderPodium(top3[0], 1) : ""}
      ${top3[1] ? renderPodium(top3[1], 2) : ""}
    </div>
  `;

  const lista = resto.length ? `
    <div class="ranking-list">
      ${resto.map((a) => renderRankingRow(a)).join("")}
    </div>
  ` : "";

  return podium + lista;
}

function renderPodium(a, pos) {
  const iniciais = (a.aluno_nome || "?").charAt(0).toUpperCase();
  return `
    <div class="podium-item pos-${pos}">
      <div class="podium-medalha">${MEDALHAS[pos - 1]}</div>
      <div class="podium-avatar">${iniciais}</div>
      <div class="podium-nome">${escapeHtml(a.aluno_nome || "Aluno")}</div>
      <div class="podium-pontos">${a.pontos} pts</div>
    </div>
  `;
}

function renderRankingRow(a) {
  const iniciais = (a.aluno_nome || "?").charAt(0).toUpperCase();
  const isEu = alunoAtual && alunoAtual.matricula === a.aluno_matricula;

  return `
    <div class="ranking-row ${isEu ? "eu" : ""}" data-matricula="${escapeHtml(a.aluno_matricula)}">
      <div class="ranking-pos">#${a.posicao}</div>
      <div class="ranking-avatar">${iniciais}</div>
      <div class="ranking-info">
        <div class="ranking-nome">${escapeHtml(a.aluno_nome || "Aluno")} ${isEu ? "(você)" : ""}</div>
        <div class="ranking-turma">${escapeHtml(a.turma || "—")}</div>
      </div>
      <div class="ranking-pontos">
        <div class="valor">${a.pontos} pts</div>
        <div class="nivel">Nível ${a.nivel}</div>
      </div>
    </div>
  `;
}

/* ============================================================
   ABA TURMAS
   ============================================================ */
async function renderTurmas() {
  const turmas = await fetch(`${API}/gamificacao/turmas`).then((r) => r.json());

  if (!turmas.length) {
    return `
      <div class="gami-empty">
        <div class="ic">🏫</div>
        Nenhuma turma no ranking ainda.
      </div>`;
  }

  return `
    <div class="turma-grid">
      ${turmas.map((t, i) => `
        <div class="turma-card pos-${i + 1}" data-turma="${escapeHtml(t.turma)}">
          <div class="turma-medalha">${MEDALHAS[i] || "🎖️"}</div>
          <div class="turma-nome">${escapeHtml(t.turma)}</div>
          <div class="turma-stats">
            <div class="turma-stat">
              <div class="v">${t.pontos_total}</div>
              <div class="l">Pontos</div>
            </div>
            <div class="turma-stat">
              <div class="v">${t.media_alunos}</div>
              <div class="l">Média</div>
            </div>
          </div>
          <div style="font-size:0.75rem;color:#8895a7">
            ${t.total_alunos} aluno(s)
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ============================================================
   ABA CONQUISTAS
   ============================================================ */
async function renderConquistas() {
  const badges = [
    { icone: "🌟", nome: "Primeiros Passos", desc: "Alcance 100 pontos" },
    { icone: "🎯", nome: "Focado", desc: "Entregue 5 atividades no prazo" },
    { icone: "💬", nome: "Comunicativo", desc: "Faça 10 comentários" },
    { icone: "👏", nome: "Bem Reagido", desc: "Receba 20 reações" },
    { icone: "🔥", nome: "Em Chamas", desc: "7 dias seguidos acessando" },
    { icone: "📚", nome: "Estudioso", desc: "Participe de 3 grupos" },
    { icone: "🏆", nome: "Mestre", desc: "Alcance 500 pontos" },
    { icone: "👑", nome: "Lenda", desc: "Alcance 1000 pontos" },
    { icone: "🥇", nome: "Top 1", desc: "Seja o #1 do ranking" },
    { icone: "📖", nome: "Leitor", desc: "Leia 10 atividades" },
    { icone: "⏰", nome: "Pontual", desc: "Entregue tudo no prazo" },
    { icone: "🤝", nome: "Colaborador", desc: "Ajude 5 colegas" },
  ];

  return `
    <div class="conquistas-grid">
      ${badges.map((b) => `
        <div class="conquista-card">
          <span class="conquista-icone">${b.icone}</span>
          <div class="conquista-nome">${b.nome}</div>
          <div class="conquista-desc">${b.desc}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ============================================================
   MODAL DE DETALHES
   ============================================================ */
document.addEventListener("click", async (e) => {
  const row = e.target.closest(".ranking-row");
  if (row) {
    await abrirDetalhesAluno(row.dataset.matricula);
    return;
  }

  const card = e.target.closest(".turma-card");
  if (card) {
    await abrirDetalhesTurma(card.dataset.turma);
  }
});

async function abrirDetalhesAluno(matricula) {
  const dados = await fetch(`${API}/gamificacao/aluno/${matricula}`).then((r) => r.json());
  const { pontos, conquistas, posicaoGeral, totalAlunos } = dados;

  const nome = pontos.aluno_nome || "Aluno";
  const iniciais = nome.charAt(0).toUpperCase();

  const modal = document.createElement("div");
  modal.className = "detalhes-aluno";
  modal.innerHTML = `
    <div class="detalhes-box">
      <button class="fechar-modal">✕</button>
      <div class="detalhes-avatar">${iniciais}</div>
      <div class="detalhes-nome">${escapeHtml(nome)}</div>
      <div class="detalhes-turma">${escapeHtml(pontos.turma || "—")}</div>

      <div class="detalhes-stats">
        <div class="detalhes-stat">
          <div class="v">${pontos.pontos}</div>
          <div class="l">Pontos</div>
        </div>
        <div class="detalhes-stat">
          <div class="v">${pontos.nivel}</div>
          <div class="l">Nível</div>
        </div>
        <div class="detalhes-stat">
          <div class="v">#${posicaoGeral || "—"}</div>
          <div class="l">de ${totalAlunos}</div>
        </div>
      </div>

      ${conquistas.length ? `
        <div class="detalhes-secao">
          <h4>🎖️ Conquistas</h4>
          ${conquistas.map((c) => `
            <div class="conquista-item">
              <span class="ic">${c.icone || "🏅"}</span>
              <div>
                <div class="nm">${escapeHtml(c.descricao || c.badge)}</div>
                <div class="dt">${new Date(c.conquistado_em).toLocaleDateString("pt-BR")}</div>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="detalhes-secao"><h4>🎖️ Conquistas</h4><p style="font-size:0.8rem;color:#8895a7">Nenhuma conquista ainda</p></div>`}
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector(".fechar-modal").onclick = () => modal.remove();
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

async function abrirDetalhesTurma(turma) {
  const dados = await fetch(`${API}/gamificacao/turma/${encodeURIComponent(turma)}`).then((r) => r.json());
  const { info, posicaoGeral, totalTurmas, alunos } = dados;

  const modal = document.createElement("div");
  modal.className = "detalhes-aluno";
  modal.innerHTML = `
    <div class="detalhes-box">
      <button class="fechar-modal">✕</button>
      <div class="detalhes-avatar" style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#1e3c72">🏫</div>
      <div class="detalhes-nome">${escapeHtml(turma)}</div>
      <div class="detalhes-turma">#${posicaoGeral || "—"} de ${totalTurmas} turmas</div>

      <div class="detalhes-stats">
        <div class="detalhes-stat">
          <div class="v">${info.pontos_total}</div>
          <div class="l">Total</div>
        </div>
        <div class="detalhes-stat">
          <div class="v">${info.media_alunos}</div>
          <div class="l">Média</div>
        </div>
        <div class="detalhes-stat">
          <div class="v">${info.total_alunos}</div>
          <div class="l">Alunos</div>
        </div>
      </div>

      ${alunos.length ? `
        <div class="detalhes-secao">
          <h4>👥 Top alunos</h4>
          ${alunos.slice(0, 10).map((a, i) => `
            <div class="conquista-item">
              <span class="ic">${MEDALHAS[i] || `#${i + 1}`}</span>
              <div style="flex:1">
                <div class="nm">${escapeHtml(a.aluno_nome || "Aluno")}</div>
                <div class="dt">${a.pontos} pts • Nível ${a.nivel}</div>
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector(".fechar-modal").onclick = () => modal.remove();
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

/* ============================================================
   UTILS
   ============================================================ */
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   INICIALIZA
   ============================================================ */
carregarAba("alunos");
