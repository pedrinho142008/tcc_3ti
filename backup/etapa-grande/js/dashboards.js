/* ============================================================
   DASHBOARDS — Professor e Aluno
   ============================================================ */
import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

const TURMAS = ["1º Ano A", "1º Ano T.I", "2º Ano A", "2º Ano T.I", "3º Ano A", "3º Ano T.I"];

function nomeCompletoTurma(codigo) {
  if (codigo.includes("T.I")) return `${codigo.replace(" T.I", "")} — Técnico`;
  const partes = codigo.split(" ");
  const sufixo = partes[2];
  const turno = sufixo === "A" ? "Matutino" : sufixo === "B" ? "Vespertino" : "Noturno";
  return `${partes[0]} ${partes[1]} — Regular (${turno})`;
}

/* ============================================================
   DASHBOARD PRINCIPAL DO PROFESSOR — lista turmas
   ============================================================ */
export async function renderDashboardProfessor() {
  mostrarLoading("Carregando turmas...");
  try {
    const turmasInfo = await Promise.all(
      TURMAS.map(async (t) => {
        try {
          const dados = await api(`/api/turmas/${encodeURIComponent(t)}/dashboard`);
          return { turma: t, ...dados };
        } catch {
          return { turma: t, totalAlunos: 0, totalAtividades: 0, totalEnvios: 0, entregasPendentes: 0, mediaTurma: null };
        }
      })
    );

    return `
      <div class="dash-turmas-grid">
        ${turmasInfo.map((t) => `
          <div class="dash-turma-card" data-dash-turma="${esc(t.turma)}">
            <div class="dash-turma-header">
              <div class="dash-turma-icon ${t.turma.includes("T.I") ? "tecnico" : ""}">
                ${esc(t.turma.charAt(0))}
              </div>
              <div class="dash-turma-info">
                <div class="dash-turma-nome">${esc(t.turma)}</div>
                <div class="dash-turma-sub">${nomeCompletoTurma(t.turma)}</div>
              </div>
            </div>
            <div class="dash-turma-stats">
              <div class="dash-turma-stat">
                <div class="valor">${t.totalAlunos}</div>
                <div class="label">Alunos</div>
              </div>
              <div class="dash-turma-stat">
                <div class="valor ${t.entregasPendentes > 5 ? "alerta" : ""}">${t.entregasPendentes}</div>
                <div class="label">Pendentes</div>
              </div>
              <div class="dash-turma-stat">
                <div class="valor ${t.mediaTurma && parseFloat(t.mediaTurma) >= 7 ? "ok" : t.mediaTurma && parseFloat(t.mediaTurma) < 6 ? "perigo" : ""}">
                  ${t.mediaTurma || "—"}
                </div>
                <div class="label">Média</div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } finally {
    esconderLoading();
  }
}

/* ============================================================
   DASHBOARD DE UMA TURMA ESPECÍFICA
   ============================================================ */
export async function renderDashboardTurma(turma) {
  mostrarLoading("Carregando dashboard...");
  try {
    const d = await api(`/api/turmas/${encodeURIComponent(turma)}/dashboard`);

    // Renderiza
    const html = `
      <button class="dash-voltar" id="btn-voltar-dash">← Voltar para turmas</button>

      <h2 class="dash-turma-titulo">${esc(turma)}</h2>
      <p class="dash-turma-subtitulo">${nomeCompletoTurma(turma)} • ${d.totalAlunos} aluno(s)</p>

      <!-- 4 CARDS PRINCIPAIS -->
      <div class="dash-stats">
        <div class="dash-stat">
          <div class="icone">📚</div>
          <div class="valor azul" data-count="${d.totalAtividades}">0</div>
          <div class="label">Atividades</div>
        </div>
        <div class="dash-stat">
          <div class="icone">📥</div>
          <div class="valor laranja" data-count="${d.entregasPendentes}">0</div>
          <div class="label">Pendentes</div>
        </div>
        <div class="dash-stat">
          <div class="icone">✅</div>
          <div class="valor verde" data-count="${d.entregasCorrigidas}">0</div>
          <div class="label">Corrigidas</div>
        </div>
        <div class="dash-stat">
          <div class="icone">🎯</div>
          <div class="valor roxo" data-count="${d.mediaTurma ? Math.round(parseFloat(d.mediaTurma) * 10) : 0}" data-decimal="true">0</div>
          <div class="label">Média</div>
        </div>
      </div>

      <!-- GRÁFICO DE ENTREGAS (14 DIAS) -->
      <div class="dash-chart-linha">
        <div class="dash-linha-titulo">📈 Entregas nos últimos 14 dias</div>
        ${renderGraficoLinha(d.porDia)}
      </div>

      <!-- ALUNOS SEM ENTREGA -->
      ${d.alunosSemEntrega?.length ? `
        <div class="dash-historico" style="border-left:4px solid #e53e3e">
          <div class="dash-historico-titulo" style="color:#991b1b">
            🚨 ${d.alunosSemEntrega.length} aluno(s) sem nenhuma entrega
          </div>
          <div style="font-size:0.85rem;color:#991b1b;line-height:1.6">
            ${d.alunosSemEntrega.slice(0, 10).map((n) => esc(n)).join(" • ")}
            ${d.alunosSemEntrega.length > 10 ? ` e mais ${d.alunosSemEntrega.length - 10}...` : ""}
          </div>
        </div>
      ` : ""}

      <!-- HISTÓRICO DE ALUNOS -->
      <div class="dash-historico">
        <div class="dash-historico-titulo">
          <span>👥 Histórico de alunos (${d.totalAlunos})</span>
          <input type="text" class="dash-busca" id="busca-aluno" placeholder="Buscar aluno..." />
        </div>
        <div id="lista-alunos-dash">
          ${d.alunosHistorico.map((a) => renderAlunoRow(a)).join("")}
        </div>
      </div>

      <!-- RANKING TOP 10 -->
      ${d.ranking?.length ? `
        <div class="dash-historico">
          <div class="dash-historico-titulo">🏆 Ranking de entregas (top 10)</div>
          ${d.ranking.map((r, i) => `
            <div class="dash-aluno-row">
              <div class="dash-aluno-avatar" style="background:${i === 0 ? "linear-gradient(135deg,#ffd700,#ffae00)" : i === 1 ? "linear-gradient(135deg,#d1d5db,#9ca3af)" : i === 2 ? "linear-gradient(135deg,#fbbf24,#d97706)" : "linear-gradient(135deg,#1e3c72,#2a5298)"};color:${i < 3 ? "#1e3c72" : "white"}">
                ${i + 1}
              </div>
              <div class="dash-aluno-info">
                <div class="dash-aluno-nome">${esc(r.nome)}</div>
                <div class="dash-aluno-mat">${esc(r.matricula)}</div>
              </div>
              <div class="dash-aluno-media">
                <div class="v">${r.entregas}</div>
                <div class="l">entregas</div>
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    `;

    setTimeout(() => animarDashboardTurma(), 50);
    return html;
  } catch (e) {
    return `<div class="card-painel" style="color:#c53030">Erro: ${esc(e.message)}</div>`;
  } finally {
    esconderLoading();
  }
}

function renderAlunoRow(a) {
  const media = a.media ? parseFloat(a.media) : null;
  const corMedia = media === null ? "" : media >= 7 ? "ok" : media >= 5 ? "pendente" : "zero";
  const ultimaEntrega = a.ultimaEntrega ? fmtData(a.ultimaEntrega) : "—";

  return `
    <div class="dash-aluno-row" data-aluno-row data-nome="${esc(a.nome.toLowerCase())}">
      <div class="dash-aluno-avatar">${esc((a.nome || "?").charAt(0).toUpperCase())}</div>
      <div class="dash-aluno-info">
        <div class="dash-aluno-nome">${esc(a.nome)}</div>
        <div class="dash-aluno-mat">${esc(a.matricula)} • última: ${ultimaEntrega}</div>
      </div>
      <div class="dash-aluno-badges">
        ${a.totalEntregas === 0
          ? `<span class="dash-badge-mini zero">0 entregas</span>`
          : a.enviouTodas
            ? `<span class="dash-badge-mini ok">${a.totalEntregas} entregas</span>`
            : `<span class="dash-badge-mini pendente">${a.totalEntregas} entregas</span>`
        }
      </div>
      <div class="dash-aluno-media">
        <div class="v" style="color:${corMedia === "ok" ? "#38a169" : corMedia === "pendente" ? "#ed8936" : corMedia === "zero" ? "#e53e3e" : "#1e3c72"}">${a.media || "—"}</div>
        <div class="l">média</div>
      </div>
    </div>
  `;
}

/* ============================================================
   GRÁFICO DE LINHA (SVG)
   ============================================================ */
function renderGraficoLinha(porDia) {
  const maxValor = Math.max(...porDia.map((d) => d.count), 1);
  const w = 600;
  const h = 140;
  const padding = 20;
  const pontos = porDia.map((d, i) => {
    const x = padding + (i / (porDia.length - 1)) * (w - padding * 2);
    const y = h - padding - (d.count / maxValor) * (h - padding * 2);
    return { x, y, ...d };
  });

  const pathD = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const pathArea = `${pathD} L ${pontos[pontos.length - 1].x} ${h - padding} L ${pontos[0].x} ${h - padding} Z`;

  return `
    <svg class="dash-linha-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2a5298" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#2a5298" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${pathArea}" fill="url(#gradArea)" />
      <path d="${pathD}" fill="none" stroke="#2a5298" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${pontos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#2a5298" stroke="white" stroke-width="2" />`).join("")}
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:#8895a7;margin-top:8px;padding:0 6px">
      ${porDia.map((d) => `<span>${d.dia}</span>`).join("")}
    </div>
  `;
}

/* ============================================================
   ANIMAÇÕES DO DASHBOARD
   ============================================================ */
function animarDashboardTurma() {
  // Conta números
  document.querySelectorAll("[data-count]").forEach((el) => {
    const alvo = parseInt(el.dataset.count) || 0;
    const decimal = el.dataset.decimal === "true";

    if (alvo === 0) {
      el.textContent = decimal ? "0.0" : "0";
      return;
    }

    const duracao = 1000;
    const passo = 16;
    const incremento = alvo / (duracao / passo);
    let atual = 0;

    const timer = setInterval(() => {
      atual += incremento;
      if (atual >= alvo) {
        atual = alvo;
        clearInterval(timer);
      }
      el.textContent = decimal ? (atual / 10).toFixed(1) : Math.round(atual);
    }, passo);
  });

  // Bind da busca de aluno
  const busca = document.getElementById("busca-aluno");
  if (busca) {
    busca.addEventListener("input", (e) => {
      const termo = e.target.value.toLowerCase();
      document.querySelectorAll("[data-aluno-row]").forEach((row) => {
        const nome = row.dataset.nome || "";
        row.style.display = nome.includes(termo) ? "flex" : "none";
      });
    });
  }

  // Bind do voltar
  document.getElementById("btn-voltar-dash")?.addEventListener("click", () => {
    window.__voltarDashboard?.();
  });
}

/* ============================================================
   MURAL SEMANAL DO ALUNO
   ============================================================ */
export async function renderMuralSemanal() {
  const hoje = new Date();
  const dias = [];

  // Pega os próximos 7 dias
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + i);
    dias.push(d);
  }

  // Busca todas as atividades do aluno
  const atividades = await api("/api/classroom/atividades").catch(() => []);

  const nomesDias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  return `
    <div class="mural-aluno">
      <div class="mural-titulo">📅 Minha semana</div>
      <p class="mural-sub">Atividades e provas dos próximos 7 dias</p>

      <div class="mural-grade">
        ${dias.map((dia) => {
          const ehHoje = dia.toDateString() === hoje.toDateString();

          // Filtra atividades que têm prazo nesse dia
          const atividadesDoDia = atividades.filter((a) => {
            if (!a.prazo) return false;
            const prazo = new Date(a.prazo);
            return prazo.toDateString() === dia.toDateString();
          });

          return `
            <div class="mural-dia ${ehHoje ? "hoje" : ""}">
              <div class="mural-dia-nome">
                ${nomesDias[dia.getDay()].slice(0, 3)}
                <span class="num">${dia.getDate()}</span>
              </div>
              ${atividadesDoDia.length
                ? atividadesDoDia.map((a) => `
                    <div class="mural-materia">
                      <div style="font-size:0.68rem;color:#8895a7;font-weight:700">${esc(a.turma)}</div>
                      ${esc(a.titulo)}
                    </div>
                  `).join("")
                : `<div class="mural-vazio">Nada programado</div>`
              }
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

// Expõe uma função global de "voltar"
window.__voltarDashboard = null;
