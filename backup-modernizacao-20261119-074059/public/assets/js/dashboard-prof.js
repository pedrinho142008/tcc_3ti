/* ============================================================
   DASHBOARD DO PROFESSOR — Animações e gráficos
   ============================================================ */
import { api, esc, fmtData } from "/assets/js/shared.js";

export async function renderDashboard() {
  const dados = await api("/api/professor/dashboard").catch(() => null);
  if (!dados) return `<div class="card-painel"><p style="color:#c53030">Erro ao carregar dashboard</p></div>`;

  const taxaEntrega = dados.totalEnvios > 0
    ? Math.round((dados.entregasCorrigidas / dados.totalEnvios) * 100)
    : 0;

  const html = `
    <!-- CARDS PRINCIPAIS -->
    <div class="dash-grid">
      ${card({ icone: "📚", cor: "azul", valor: dados.totalAtividades, label: "Atividades ativas", delay: 0 })}
      ${card({ icone: "📥", cor: "laranja", valor: dados.entregasPendentes, label: "Entregas p/ corrigir", delay: 100 })}
      ${card({ icone: "👥", cor: "roxo", valor: dados.totalAlunos, label: "Total de alunos", delay: 200 })}
      ${card({ icone: "⚠️", cor: "vermelho", valor: dados.alunosSemEntregar, label: "Sem entregar", delay: 300 })}
    </div>

    <!-- GRÁFICO DE BARRAS — ENTREGAS NOS ÚLTIMOS 7 DIAS -->
    <div class="dash-chart">
      <div class="dash-chart-titulo">📊 Entregas nos últimos 7 dias</div>
      <div class="dash-barras" id="dash-barras">
        ${dados.entregasPorDia.map((d) => `
          <div class="dash-barra-col">
            <div class="dash-barra-valor">${d.count}</div>
            <div class="dash-barra" data-valor="${d.count}" style="height: 0;"></div>
            <div class="dash-barra-label">${d.dia}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- PROGRESSO GERAL + PRÓXIMOS PRAZOS -->
    <div class="dash-chart" style="display:grid;grid-template-columns:1fr;gap:20px">
      <div>
        <div class="dash-chart-titulo">🎯 Taxa de correção</div>
        <div class="dash-donut">
          <svg viewBox="0 0 100 100">
            <defs>
              <linearGradient id="gradDonut" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#4a7bc8"/>
                <stop offset="100%" stop-color="#1e3c72"/>
              </linearGradient>
            </defs>
            <circle class="bg" cx="50" cy="50" r="42" />
            <circle class="fill" cx="50" cy="50" r="42"
              stroke-dasharray="263.9"
              stroke-dashoffset="263.9"
              data-percent="${taxaEntrega}" />
          </svg>
          <div class="dash-donut-centro">
            <div class="v" data-count="${taxaEntrega}">0%</div>
            <div class="l">corrigido</div>
          </div>
        </div>
        <p style="text-align:center;font-size:0.78rem;color:#8895a7;margin-top:14px">
          ${dados.entregasCorrigidas} de ${dados.totalEnvios} entregas corrigidas
        </p>
      </div>
    </div>

    <!-- PRÓXIMOS PRAZOS -->
    ${dados.proximosPrazos?.length ? `
      <div class="dash-prazos">
        <div class="dash-chart-titulo">⏰ Próximos prazos (7 dias)</div>
        ${dados.proximosPrazos.map((p) => {
          const dias = Math.ceil((new Date(p.prazo) - new Date()) / 86400000);
          const classe = dias <= 1 ? "urgente" : dias <= 3 ? "atencao" : "";
          return `
            <div class="dash-prazo-item ${classe}">
              <div class="dash-prazo-dias">
                <div class="num">${dias}</div>
                <div class="txt">${dias === 1 ? "dia" : "dias"}</div>
              </div>
              <div class="dash-prazo-info">
                <div class="dash-prazo-titulo">${esc(p.titulo)}</div>
                <div class="dash-prazo-meta">${esc(p.turma)}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : ""}

    <!-- ATIVIDADES POR TURMA -->
    <div class="dash-chart">
      <div class="dash-chart-titulo">📚 Atividades por turma</div>
      <div class="dash-barras" id="dash-barras-turma">
        ${Object.entries(dados.atividadesPorTurma).map(([turma, count]) => `
          <div class="dash-barra-col">
            <div class="dash-barra-valor">${count}</div>
            <div class="dash-barra" data-valor="${count}" style="height: 0;"></div>
            <div class="dash-barra-label">${esc(turma.replace("Ano", "").replace(" ", ""))}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- TOP 5 ALUNOS -->
    ${dados.topAlunos?.length ? `
      <div class="dash-top">
        <div class="dash-chart-titulo">🏆 Top 5 alunos (mais entregas)</div>
        ${dados.topAlunos.map((a, i) => `
          <div class="dash-top-item">
            <div class="dash-top-pos">${i + 1}</div>
            <div class="dash-top-info">
              <div class="dash-top-nome">${esc(a.nome)}</div>
              <div class="dash-top-meta">${esc(a.turma)}</div>
            </div>
            <div class="dash-top-entregas">${a.entregas}</div>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  // Agenda as animações depois que o HTML é inserido
  setTimeout(() => animarDashboard(), 50);
  return html;
}

function card({ icone, cor, valor, label, delay }) {
  return `
    <div class="dash-card" style="animation: fadeInUp 0.5s ease ${delay}ms backwards">
      <div class="dash-icon ${cor}">${icone}</div>
      <div class="dash-valor ${cor}" data-count="${valor}">0</div>
      <div class="dash-label">${esc(label)}</div>
    </div>
  `;
}

/* ============================================================
   ANIMAÇÕES
   ============================================================ */
function animarDashboard() {
  // 1. Anima os números (count up)
  document.querySelectorAll("[data-count]").forEach((el) => {
    const alvo = parseInt(el.dataset.count);
    if (isNaN(alvo) || alvo === 0) {
      el.textContent = "0";
      return;
    }

    const duracao = 1200;
    const passo = 16;
    const incremento = alvo / (duracao / passo);
    let atual = 0;

    const timer = setInterval(() => {
      atual += incremento;
      if (atual >= alvo) {
        atual = alvo;
        clearInterval(timer);
      }
      // Verifica se é porcentagem
      if (el.textContent.includes("%")) {
        el.textContent = Math.round(atual) + "%";
      } else {
        el.textContent = Math.round(atual);
      }
    }, passo);
  });

  // 2. Anima as barras (cresce de baixo pra cima)
  const maxAltura = 120;
  ["dash-barras", "dash-barras-turma"].forEach((id) => {
    const container = document.getElementById(id);
    if (!container) return;

    const barras = container.querySelectorAll(".dash-barra");
    const valores = Array.from(barras).map((b) => parseInt(b.dataset.valor) || 0);
    const maxValor = Math.max(...valores, 1);

    barras.forEach((b, i) => {
      const valor = valores[i];
      const altura = (valor / maxValor) * maxAltura;
      setTimeout(() => {
        b.style.height = Math.max(altura, 4) + "px";
      }, i * 80 + 200);
    });
  });

  // 3. Anima o donut (stroke-dashoffset)
  const donut = document.querySelector(".dash-donut .fill");
  if (donut) {
    const percent = parseInt(donut.dataset.percent);
    const total = 263.9; // 2 * PI * 42
    const offset = total - (total * percent / 100);
    setTimeout(() => {
      donut.style.strokeDashoffset = offset;
    }, 300);
  }
}

/* ============================================================
   CSS de animação injetado
   ============================================================ */
const styleAnim = document.createElement("style");
styleAnim.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
if (!document.getElementById("dash-anim-style")) {
  styleAnim.id = "dash-anim-style";
  document.head.appendChild(styleAnim);
}
