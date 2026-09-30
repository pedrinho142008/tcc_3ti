import { api, esc, fmtData, mostrarLoading, esconderLoading, calcularMedias } from "/assets/js/shared.js";

/* ============================================================
   MENU HAMBÚRGUER
   ============================================================ */
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const hamburger = document.getElementById("btn-hamburger");

function abrirMenu() {
  sidebar.classList.add("aberto");
  overlay.classList.add("ativo");
  hamburger.classList.add("aberto");
}

function fecharMenu() {
  sidebar.classList.remove("aberto");
  overlay.classList.remove("ativo");
  hamburger.classList.remove("aberto");
}

function toggleMenu() {
  if (sidebar.classList.contains("aberto")) fecharMenu();
  else abrirMenu();
}

hamburger.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleMenu();
});

overlay.addEventListener("click", fecharMenu);

// Fecha menu ao clicar num item (mobile)
document.querySelectorAll(".painel-nav-item").forEach((b) => {
  b.addEventListener("click", () => {
    if (window.innerWidth < 900) fecharMenu();
  });
});

/* ============================================================
   ALUNO LOGADO
   ============================================================ */
let alunoAtual = null;
const alunoStr = localStorage.getItem("aluno");
if (!alunoStr) window.location.href = "/portal-aluno.html";

try {
  alunoAtual = JSON.parse(alunoStr);
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

const setTxt = (id, valor) => {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
};

setTxt("user-nome", alunoAtual.nome || "—");
setTxt("user-cargo", alunoAtual.matricula || "—");
setTxt("user-avatar", (alunoAtual.nome || "A").charAt(0).toUpperCase());
setTxt("user-nome-sidebar", alunoAtual.nome || "—");
setTxt("user-cargo-sidebar", alunoAtual.matricula || "—");
setTxt("user-avatar-sidebar", (alunoAtual.nome || "A").charAt(0).toUpperCase());

document.getElementById("btn-sair").addEventListener("click", async () => {
  await api("/api/aluno/logout", { method: "POST" }).catch(() => {});
  localStorage.removeItem("aluno");
  window.location.href = "/portal-aluno.html";
});

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const titulos = {
  home:        ["Início", "Bem-vindo(a) de volta!"],
  desempenho:  ["Desempenho", "Veja como você está indo"],
  boletim:     ["Boletim", "Suas notas por disciplina"],
  historico:   ["Histórico", "Atividades que você entregou"],
  enviar:      ["Enviar atividade", "Envie um trabalho para seu professor"],
  anotacoes:   ["Anotações", "Seu caderno digital"],
};

/* ============================================================
   NAVEGAÇÃO — listeners dos botões do menu
   ============================================================ */
document.querySelectorAll(".painel-nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".painel-nav-item").forEach((x) => x.classList.remove("ativo"));
    btn.classList.add("ativo");
    const aba = btn.dataset.aba;
    setTxt("titulo-aba", titulos[aba][0]);
    setTxt("sub-aba", titulos[aba][1]);
    setTxt("topbar-aba", titulos[aba][0]);
    if (window.innerWidth < 900) fecharMenu();
    carregar(aba);
  });
});

/* ============================================================
   TOPNAV (desktop) — sincronizar com sidebar
   ============================================================ */
document.querySelectorAll(".painel-topnav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const aba = btn.dataset.abaTop;
    document.querySelectorAll(".painel-topnav-item").forEach((x) => x.classList.remove("ativo"));
    btn.classList.add("ativo");
    document.querySelectorAll(".painel-nav-item").forEach((x) => {
      x.classList.toggle("ativo", x.dataset.aba === aba);
    });
    setTxt("titulo-aba", titulos[aba][0]);
    setTxt("sub-aba", titulos[aba][1]);
    setTxt("topbar-aba", titulos[aba][0]);
    carregar(aba);
  });
});

/* ============================================================
   ROUTER
   ============================================================ */
async function carregar(aba) {
  const el = document.getElementById("conteudo-aluno");
  if (!el) return;
  mostrarLoading("Carregando...");
  try {
    if (aba === "home")         el.innerHTML = await renderHome();
    if (aba === "desempenho")   el.innerHTML = await renderDesempenho();
    if (aba === "boletim")      { el.innerHTML = renderLoadingBoletim(); await renderBoletimComEspera(); }
    if (aba === "historico")    el.innerHTML = await renderHistorico();
    if (aba === "enviar")       { el.innerHTML = await renderEnviar(); bindEnviar(); }
    if (aba === "anotacoes")    { el.innerHTML = await renderAnotacoes(); bindAnotacoes(); }
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="card-painel" style="color:#c53030">Erro: ${esc(e.message)}</div>`;
  } finally {
    esconderLoading();
  }
}

/* ============================================================
   HOME — atividades dos professores
   ============================================================ */
async function renderHome() {
  const turma = alunoAtual.turma || alunoAtual.perfil?.turma || "";
  const atividades = await api(`/api/classroom/atividades?turma=${encodeURIComponent(turma)}`).catch(() => []);

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      <div class="turma-card" style="cursor:default">
        <div class="turma-card-titulo">${atividades.length}</div>
        <div class="turma-card-sub">Atividades abertas</div>
      </div>
      <div class="turma-card" style="cursor:default">
        <div class="turma-card-titulo" style="font-size:0.95rem">${esc(turma || "—")}</div>
        <div class="turma-card-sub">Sua turma</div>
      </div>
    </div>

    <div class="card-painel">
      <h2 class="card-painel-titulo">
        <svg viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        Atividades dos professores
      </h2>

      ${atividades.length ? `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${atividades.map(renderAtividadeHome).join("")}
        </div>
      ` : `
        <div style="text-align:center;padding:32px 20px;color:#8895a7">
          <div style="font-size:3rem;opacity:0.4">📚</div>
          <p style="margin-top:12px">Nenhuma atividade aberta</p>
        </div>
      `}
    </div>
  `;
}

function renderAtividadeHome(a) {
  const prazo = a.prazo ? new Date(a.prazo) : null;
  const dias = prazo ? Math.ceil((prazo - new Date()) / 86400000) : null;
  let cor = "#38a169";
  if (dias !== null) {
    if (dias < 0) cor = "#e53e3e";
    else if (dias <= 2) cor = "#ed8936";
  }

  return `
    <div style="background:#f8fafc;border-radius:14px;padding:16px;border-left:4px solid #2a5298">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:700;color:#1e3c72;font-size:0.98rem;margin-bottom:4px">${esc(a.titulo)}</div>
          <div style="font-size:0.78rem;color:#8895a7">
            ${esc(a.professor_nome || "Professor")} • ${fmtData(a.criado_em)}
          </div>
        </div>
        ${prazo ? `<span style="padding:5px 10px;border-radius:8px;background:${cor}20;color:${cor};font-size:0.72rem;font-weight:700">
          ${dias >= 0 ? `${dias}d` : "Expirado"}
        </span>` : ""}
      </div>
      ${a.descricao ? `<p style="margin-top:10px;font-size:0.85rem;color:#4a5568;line-height:1.5">${esc(a.descricao)}</p>` : ""}
      ${a.arquivo_url ? `<a href="${esc(a.arquivo_url)}" target="_blank" style="display:inline-block;margin-top:8px;color:#2a5298;font-weight:600;font-size:0.82rem">📎 Ver anexo</a>` : ""}
    </div>
  `;
}

/* ============================================================
   DESEMPENHO
   ============================================================ */
async function renderDesempenho() {
  let boletim = null;
  try {
    boletim = await api("/api/aluno/boletim");
  } catch (e) {
    boletim = null;
  }

  if (!boletim || !boletim.disciplinas?.length) {
    return `
      <div class="card-painel" style="text-align:center;padding:40px">
        <div style="font-size:3rem;opacity:0.5">📊</div>
        <p style="margin-top:12px;color:#5a6472;font-weight:600">O boletim ainda não foi carregado</p>
        <p style="font-size:0.82rem;color:#8895a7;margin-top:6px">Vá na aba <strong>Boletim</strong> e aguarde o carregamento</p>
        <button onclick="document.querySelector('[data-aba=\'boletim\']')?.click()"
          style="margin-top:18px;padding:12px 22px;background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;border:none;border-radius:12px;font-family:inherit;font-weight:700;cursor:pointer;font-size:0.88rem">
          📚 Ir para Boletim
        </button>
      </div>`;
  }

  const { disciplinas: notas, media: mediaGeral } = calcularMedias(boletim, "B");

  // CORRIGIDO: protege contra null/undefined
  const mediaValida = (typeof mediaGeral === "number" && !isNaN(mediaGeral)) ? mediaGeral : null;
  const corMedia = mediaValida === null ? "#8895a7"
    : mediaValida >= 7 ? "#38a169"
    : mediaValida >= 6 ? "#ed8936"
    : "#e53e3e";

  const notasValidas = notas.filter((n) => typeof n.media === "number" && !isNaN(n.media));

  if (notasValidas.length === 0) {
    return `
      <div class="card-painel" style="text-align:center;padding:40px">
        <div style="font-size:3rem;opacity:0.5">📝</div>
        <p style="margin-top:12px;color:#5a6472;font-weight:600">Nenhuma nota lançada ainda</p>
        <p style="font-size:0.82rem;color:#8895a7;margin-top:6px">Aguarde os professores lançarem as notas</p>
      </div>`;
  }

  return `
    <div class="card-painel" style="text-align:center">
      <h2 class="card-painel-titulo" style="justify-content:center">
        <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        Média geral
      </h2>
      <div style="font-size:4rem;font-weight:900;color:${corMedia};line-height:1">
        ${mediaValida !== null ? mediaValida.toFixed(1) : "—"}
      </div>
      <div style="font-size:0.85rem;color:#8895a7;margin-top:8px">de 10.0</div>
    </div>

    <div class="card-painel">
      <h2 class="card-painel-titulo">
        <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        Por disciplina
      </h2>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${notasValidas.sort((a, b) => b.media - a.media).map((n) => {
          const pct = Math.max(0, Math.min(100, (n.media / 10) * 100));
          const cor = n.media >= 7 ? "#38a169" : n.media >= 6 ? "#ed8936" : "#e53e3e";
          return `
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;gap:10px">
                <span style="font-weight:600;color:#1e3c72;font-size:0.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.nome)}</span>
                <span style="font-weight:800;color:${cor};font-size:0.88rem;flex-shrink:0">${n.media.toFixed(1)}</span>
              </div>
              <div style="height:10px;background:#eef3fb;border-radius:5px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${cor},${cor}cc);border-radius:5px"></div>
              </div>
            </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

/* ============================================================
   BOLETIM — com retry e botão de recarregar
   ============================================================ */
function renderLoadingBoletim() {
  return `
    <div class="card-painel" style="text-align:center;padding:40px">
      <div style="font-size:3rem;animation:pulse 1.5s infinite">⏳</div>
      <p style="margin-top:14px;font-weight:700;color:#1e3c72">Buscando boletim no SigEduc...</p>
      <p style="font-size:0.82rem;color:#8895a7;margin-top:6px">Isso pode levar até 40 segundos</p>
      <style>@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }</style>
    </div>`;
}

async function renderBoletimComEspera() {
  const el = document.getElementById("conteudo-aluno");
  let b = null;
  let tentativas = 0;
  const MAX = 40;

  while (tentativas < MAX) {
    try {
      const r = await api("/api/aluno/boletim");
      if (r?.disciplinas?.length) { b = r; break; }
    } catch (e) {
      // Se erro de sessão, para
      if (e.message?.includes("Faça login") || e.message?.includes("expirada")) break;
    }
    tentativas++;
    el.innerHTML = `
      <div class="card-painel" style="text-align:center;padding:40px">
        <div style="font-size:3rem;opacity:0.6">⏳</div>
        <p style="margin-top:12px;font-weight:700;color:#1e3c72">Carregando boletim...</p>
        <p style="font-size:0.82rem;color:#8895a7;margin-top:6px">Tentativa ${tentativas} de ${MAX}</p>
        <div style="height:6px;background:#eef3fb;border-radius:3px;overflow:hidden;margin-top:16px;max-width:280px;margin-left:auto;margin-right:auto">
          <div style="height:100%;width:${(tentativas/MAX)*100}%;background:#2a5298;transition:width 0.3s"></div>
        </div>
      </div>`;
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!b) {
    el.innerHTML = `
      <div class="card-painel" style="text-align:center;padding:40px">
        <div style="font-size:3rem;opacity:0.5">😕</div>
        <p style="margin:12px 0;font-weight:700;color:#1e3c72;font-size:1.05rem">O SigEduc está lento agora</p>
        <p style="font-size:0.85rem;color:#8895a7;margin-bottom:20px">O sistema do Estado pode estar fora do ar. Tente novamente em alguns minutos.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button onclick="recarregarBoletim()" style="padding:12px 22px;background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;border:none;border-radius:12px;font-family:inherit;font-weight:700;cursor:pointer;font-size:0.88rem">
            🔄 Tentar de novo
          </button>
          <button onclick="location.href='/portal-aluno.html'" style="padding:12px 22px;background:#eef3fb;color:#2a5298;border:none;border-radius:12px;font-family:inherit;font-weight:700;cursor:pointer;font-size:0.88rem">
            🎓 Fazer login novamente
          </button>
        </div>
      </div>`;
    return;
  }

  const s = b.situacao || {};
  el.innerHTML = `
    <div class="card-painel" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
      ${cardResumo(s.status || "—", "Situação")}
      ${cardResumo(s.frequencia || "—", "Frequência")}
      ${cardResumo(s.faltas || "0", "Faltas")}
      ${cardResumo(s.aulasDadas || "0", "Aulas")}
    </div>

    <div class="card-painel">
      <h2 class="card-painel-titulo">
        <svg viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        Notas por disciplina
      </h2>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${b.disciplinas.map((d) => `
          <div style="padding:14px;background:#f8fafc;border-radius:14px">
            <div style="font-weight:700;color:#1e3c72;font-size:0.92rem;margin-bottom:3px">${esc(d.nome)}</div>
            <div style="font-size:0.75rem;color:#8895a7;margin-bottom:10px">${esc(d.professor || "—")}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${["1º","2º","3º","4º"].map((bim, i) => {
                const v = d[`bim${i+1}`] || "—";
                const n = parseFloat(String(v).replace(",", "."));
                const cor = isNaN(n) ? "#8895a7" : n >= 7 ? "#38a169" : n >= 6 ? "#ed8936" : "#e53e3e";
                return `<span style="padding:5px 10px;background:white;border-radius:8px;font-size:0.82rem;font-weight:700;color:${cor};border:1px solid #eef3fb">
                  <span style="font-size:0.65rem;color:#8895a7;font-weight:600">${bim}</span> ${esc(v)}
                </span>`;
              }).join("")}
              <span style="padding:5px 10px;background:#fee2e2;border-radius:8px;font-size:0.82rem;font-weight:700;color:#991b1b">
                <span style="font-size:0.65rem;font-weight:600">Faltas</span> ${esc(d.faltas || "0")}
              </span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

window.recarregarBoletim = async () => {
  mostrarLoading("Recarregando...");
  try {
    await api("/api/aluno/boletim/recarregar", { method: "POST" });
    await renderBoletimComEspera();
  } catch (e) {
    alert("Erro: " + e.message);
  } finally {
    esconderLoading();
  }
};

function cardResumo(valor, label) {
  return `
    <div style="background:linear-gradient(135deg,#f8fafc,#eef3fb);border:1px solid #e6e9ef;border-radius:14px;padding:16px 12px;text-align:center">
      <div style="font-size:1.3rem;font-weight:800;color:#1e3c72">${esc(valor)}</div>
      <div style="font-size:0.62rem;color:#8895a7;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-top:6px">${esc(label)}</div>
    </div>`;
}

/* ============================================================
   HISTÓRICO
   ============================================================ */
async function renderHistorico() {
  const envios = await api(`/api/atividades/envios/listar?aluno_matricula=${alunoAtual.matricula}`).catch(() => []);

  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">
        <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
        Minhas entregas (${envios.length})
      </h2>
      ${envios.length ? `<div style="display:flex;flex-direction:column;gap:12px">${envios.map((e) => `
        <div style="padding:14px;background:#f8fafc;border-radius:14px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div style="font-weight:700;color:#1e3c72;font-size:0.9rem">${esc(e.titulo)}</div>
            <span style="padding:4px 10px;border-radius:8px;background:#eef3fb;color:#2a5298;font-size:0.68rem;font-weight:700;text-transform:uppercase">${esc(e.status)}</span>
          </div>
          <div style="font-size:0.75rem;color:#8895a7;margin-top:4px">${esc(e.professor_nome || "")} • ${fmtData(e.criado_em)}</div>
          ${e.nota ? `<div style="margin-top:8px;font-weight:700;color:${e.nota >= 7 ? "#38a169" : "#ed8936"};font-size:0.88rem">Nota: ${e.nota}</div>` : ""}
        </div>
      `).join("")}</div>` : `<div style="text-align:center;padding:32px;color:#8895a7">Nenhuma entrega ainda</div>`}
    </div>`;
}

/* ============================================================
   ENVIAR ATIVIDADE
   ============================================================ */
async function renderEnviar() {
  const professores = await api("/api/atividades/professores/lista").catch(() => []);
  const TURMAS = ["1º Ano A", "1º Ano T.I", "2º Ano A", "2º Ano T.I", "3º Ano A", "3º Ano T.I"];

  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">
        <svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        Nova entrega
      </h2>
      <form id="form-envio" style="display:flex;flex-direction:column;gap:16px">
        <label style="font-size:0.8rem;font-weight:700;color:#5a6472;text-transform:uppercase;letter-spacing:0.3px">
          Professor(a)
          <select name="professor" required style="width:100%;margin-top:8px;padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc;text-transform:none">
            <option value="">Selecione</option>
            ${professores.map((p) => `<option value="${p.id}" data-nome="${esc(p.nome)}">${esc(p.nome)}</option>`).join("")}
          </select>
        </label>

        <label style="font-size:0.8rem;font-weight:700;color:#5a6472;text-transform:uppercase;letter-spacing:0.3px">
          Turma
          <select name="turma" required style="width:100%;margin-top:8px;padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc;text-transform:none">
            <option value="">Selecione</option>
            ${TURMAS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
        </label>

        <label style="font-size:0.8rem;font-weight:700;color:#5a6472;text-transform:uppercase;letter-spacing:0.3px">
          Arquivo
          <div id="ua-envio" style="border:2px dashed #c7d2e0;border-radius:12px;padding:24px;text-align:center;background:#fafbfc;cursor:pointer;margin-top:8px">
            <div id="uc-envio">
              <div style="font-size:1.8rem;color:#8895a7">📎</div>
              <div style="font-size:0.85rem;color:#5a6472;margin-top:6px">Clique para escolher</div>
            </div>
          </div>
          <input type="file" id="file-envio" accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx" style="display:none" />
        </label>

        <label style="font-size:0.8rem;font-weight:700;color:#5a6472;text-transform:uppercase;letter-spacing:0.3px">
          Título
          <input name="titulo" required placeholder="Ex: Lista 3" style="width:100%;margin-top:8px;padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc;text-transform:none" />
        </label>

        <label style="font-size:0.8rem;font-weight:700;color:#5a6472;text-transform:uppercase;letter-spacing:0.3px">
          Descrição
          <textarea name="descricao" placeholder="Detalhes..." style="width:100%;margin-top:8px;padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc;min-height:100px;resize:vertical;text-transform:none"></textarea>
        </label>

        <button type="submit" style="padding:14px 24px;border:none;border-radius:12px;background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;font-family:inherit;font-size:0.92rem;font-weight:700;cursor:pointer">
          Enviar atividade
        </button>
      </form>
    </div>
  `;
}

function bindEnviar() {
  const area = document.getElementById("ua-envio");
  const file = document.getElementById("file-envio");
  const content = document.getElementById("uc-envio");
  let arquivoMeta = null;

  area.addEventListener("click", () => file.click());

  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    content.innerHTML = `<div style="font-size:1.5rem">📄</div><div style="font-size:0.85rem;color:#2a5298;font-weight:600;margin-top:6px">${esc(f.name)}</div>`;

    mostrarLoading("Enviando...");
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      const r = await fetch("/api/atividades/upload", { method: "POST", credentials: "include", body: fd });
      const data = await r.json();
      if (data.url) arquivoMeta = data;
    } catch (e) { alert("Erro: " + e.message); }
    finally { esconderLoading(); }
  });

  document.getElementById("form-envio")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const sel = e.target.querySelector('[name="professor"]');
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
      alert("✅ Enviado!");
      carregar("historico");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });
}

/* ============================================================
   ANOTAÇÕES
   ============================================================ */
async function renderAnotacoes() {
  const notas = await api(`/api/aluno/anotacoes?matricula=${alunoAtual.matricula}`).catch(() => []);
  const porTipo = {
    prova: notas.filter((n) => n.tipo === "prova"),
    entrega: notas.filter((n) => n.tipo === "entrega"),
    dificuldade: notas.filter((n) => n.tipo === "dificuldade"),
    horario: notas.filter((n) => n.tipo === "horario"),
    geral: notas.filter((n) => n.tipo === "geral"),
  };

  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">
        <svg viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/></svg>
        Nova anotação
      </h2>
      <form id="form-anot" style="display:flex;flex-direction:column;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <select name="tipo" required style="padding:12px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.88rem;background:#f8fafc">
            <option value="geral">📝 Geral</option>
            <option value="horario">🕐 Horário</option>
            <option value="prova">📅 Prova</option>
            <option value="entrega">📤 Entrega</option>
            <option value="dificuldade">⚠️ Dificuldade</option>
          </select>
          <select name="prioridade" style="padding:12px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.88rem;background:#f8fafc">
            <option value="normal">Normal</option>
            <option value="alta">🔴 Alta</option>
            <option value="baixa">🟢 Baixa</option>
          </select>
        </div>
        <input name="titulo" required placeholder="Título" style="padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc" />
        <textarea name="conteudo" placeholder="Detalhes..." style="padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc;min-height:80px;resize:vertical"></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <input name="materia" placeholder="Matéria" style="padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc" />
          <input name="data_entrega" type="datetime-local" style="padding:14px 16px;border:1.5px solid #e6e9ef;border-radius:12px;font-family:inherit;font-size:0.92rem;background:#f8fafc" />
        </div>
        <button type="submit" style="padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;font-family:inherit;font-size:0.92rem;font-weight:700;cursor:pointer">Adicionar</button>
      </form>
    </div>

    ${renderSecao("📅 Provas", porTipo.prova)}
    ${renderSecao("📤 Entregas", porTipo.entrega)}
    ${renderSecao("⚠️ Dificuldades", porTipo.dificuldade)}
    ${renderSecao("🕐 Horários", porTipo.horario)}
    ${renderSecao("📝 Anotações gerais", porTipo.geral)}
  `;
}

function renderSecao(titulo, lista) {
  if (!lista.length) return "";
  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">${titulo} (${lista.length})</h2>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${lista.map((n) => `
          <div style="padding:14px;background:#f8fafc;border-radius:12px;border-left:3px solid ${n.prioridade === "alta" ? "#e53e3e" : n.prioridade === "baixa" ? "#38a169" : "#2a5298"}">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
              <div style="flex:1">
                <div style="font-weight:700;color:#1e3c72;font-size:0.9rem">${esc(n.titulo)}</div>
                ${n.materia ? `<div style="font-size:0.7rem;color:#8895a7;margin-top:2px">${esc(n.materia)}</div>` : ""}
                ${n.conteudo ? `<p style="font-size:0.84rem;color:#4a5568;margin-top:6px;line-height:1.5">${esc(n.conteudo)}</p>` : ""}
                ${n.data_entrega ? `<div style="font-size:0.7rem;color:#2a5298;margin-top:6px;font-weight:600">📅 ${new Date(n.data_entrega).toLocaleString("pt-BR")}</div>` : ""}
              </div>
              <button class="btn-del-anot" data-id="${n.id}" style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:1.1rem;padding:4px">✕</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>`;
}

function bindAnotacoes() {
  document.getElementById("form-anot")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Salvando...");
    try {
      await api("/api/aluno/anotacoes", {
        method: "POST",
        body: JSON.stringify({
          aluno_matricula: alunoAtual.matricula,
          tipo: fd.get("tipo"),
          titulo: fd.get("titulo"),
          conteudo: fd.get("conteudo"),
          materia: fd.get("materia"),
          data_entrega: fd.get("data_entrega") || null,
          prioridade: fd.get("prioridade"),
        }),
      });
      carregar("anotacoes");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });

  document.querySelectorAll(".btn-del-anot").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir?")) return;
      mostrarLoading();
      await api(`/api/aluno/anotacoes/${b.dataset.id}`, { method: "DELETE" });
      carregar("anotacoes");
      esconderLoading();
    });
  });
}

/* ============================================================
   INIT
   ============================================================ */
carregar("home");

/* Expor no window para o menu-delegation */
if (typeof carregar === 'function') window.carregar = carregar;
if (typeof titulos !== 'undefined') window.titulos = titulos;
