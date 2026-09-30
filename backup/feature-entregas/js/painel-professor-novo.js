import { api, esc, fmtData, mostrarLoading, esconderLoading, calcularMedias } from "/assets/js/shared.js";

/* ============================================================
   ESTRUTURA DE TURMAS
   Nível → Turno → Tipo (Regular / Técnico)
   Técnico só existe no matutino.
   ============================================================ */
const ANOS = ["1º Ano", "2º Ano", "3º Ano"];

const TURNOS = {
  "1º Ano": ["Matutino", "Vespertino", "Noturno"],
  "2º Ano": ["Matutino", "Vespertino", "Noturno"],
  "3º Ano": ["Matutino", "Vespertino", "Noturno"],
};

const TIPOS = {
  "Matutino": ["Regular", "Técnico"],
  "Vespertino": ["Regular"],
  "Noturno": ["Regular"],
};

// Gera o código interno da turma: "3º Ano|Matutino|Técnico" → "3º Ano T.I"
function codigoTurma(ano, turno, tipo) {
  if (tipo === "Técnico") return `${ano} T.I`;
  const sufixo = turno === "Matutino" ? "A" : turno === "Vespertino" ? "B" : "C";
  return `${ano} ${sufixo}`;
}

function nomeCompletoTurma(codigo) {
  if (codigo.includes("T.I")) return `${codigo.replace(" T.I", "")} — Técnico (Matutino)`;
  const partes = codigo.split(" ");
  const ano = partes[0] + " " + partes[1];
  const sufixo = partes[2];
  const turno = sufixo === "A" ? "Matutino" : sufixo === "B" ? "Vespertino" : "Noturno";
  return `${ano} — Regular (${turno})`;
}

/* ============================================================
   USUÁRIO LOGADO
   ============================================================ */
let user = null;
try { user = await api("/api/users/me"); } catch { window.location.href = "/login.html"; }

const nomeUser = user?.nome || "—";
const cargoUser = user?.cargo || user?.tipo || "—";
const inicialUser = nomeUser.charAt(0).toUpperCase();

const setTxt = (id, v) => {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
};

setTxt("user-nome", nomeUser);
setTxt("user-avatar", inicialUser);
setTxt("user-nome-sidebar", nomeUser);
setTxt("user-cargo-sidebar", cargoUser);
setTxt("user-avatar-sidebar", inicialUser);

document.getElementById("btn-sair")?.addEventListener("click", async () => {
  await api("/api/users/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/";
});

/* ============================================================
   MENU HAMBÚRGUER
   ============================================================ */
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const hamburger = document.getElementById("btn-hamburger");

const abrirMenu = () => {
  sidebar?.classList.add("aberto");
  overlay?.classList.add("ativo");
  hamburger?.classList.add("aberto");
};

const fecharMenu = () => {
  sidebar?.classList.remove("aberto");
  overlay?.classList.remove("ativo");
  hamburger?.classList.remove("aberto");
};

hamburger?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (sidebar?.classList.contains("aberto")) fecharMenu();
  else abrirMenu();
});

overlay?.addEventListener("click", fecharMenu);

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const titulos = {
  turmas:     ["Minhas turmas",        "Acompanhe suas turmas"],
  cadastrar:  ["Cadastrar alunos",     "Adicione alunos à sua turma"],
  postar:     ["Postar atividade",     "Envie uma nova atividade"],
  entregas:   ["Entregas dos alunos",  "Veja o que os alunos enviaram"],
  desempenho: ["Desempenho",           "Análise de desempenho"],
  dicas:      ["Dicas pedagógicas",    "Sugestões"],
};

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

async function carregar(aba) {
  const el = document.getElementById("conteudo-prof");
  if (!el) return;
  el.innerHTML = `<div class="card-painel"><p style="color:#8895a7">Carregando...</p></div>`;
  try {
    let html = "";
    if (aba === "turmas")     html = await renderTurmas();
    if (aba === "cadastrar")  html = await renderCadastrar();
    if (aba === "postar")     html = await renderPostar();
    if (aba === "entregas")   html = await renderEntregas();
    if (aba === "desempenho") html = await renderDesempenhoTurmas();
    if (aba === "dicas")      html = await renderDicas();
    el.innerHTML = html;
    bind(aba);
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="card-painel" style="color:#c53030">Erro: ${esc(e.message)}</div>`;
  }
}

/* ============================================================
   TURMAS — 3 níveis → clica → mostra turnos e tipos
   ============================================================ */
async function renderTurmas() {
  const todasAtividades = await api("/api/classroom/atividades").catch(() => []);

  const anos = await Promise.all(
    ANOS.map(async (ano) => {
      let totalAlunos = 0;
      let totalAtividades = 0;
      let totalEnvios = 0;
      let totalPendentes = 0;

      for (const turno of TURNOS[ano]) {
        for (const tipo of TIPOS[turno] || []) {
          const codigo = codigoTurma(ano, turno, tipo);
          const alunos = await api(`/api/alunos/lista?turma=${encodeURIComponent(codigo)}`).catch(() => []);
          const atividades = todasAtividades.filter((a) => a.turma === codigo);
          const envios = await api(`/api/atividades/envios/listar?turma=${encodeURIComponent(codigo)}`).catch(() => []);

          totalAlunos += alunos.length;
          totalAtividades += atividades.length;
          totalEnvios += envios.length;
          totalPendentes += Math.max(0, alunos.length - new Set(envios.map((e) => e.aluno_matricula)).size);
        }
      }

      return { ano, totalAlunos, totalAtividades, totalEnvios, totalPendentes };
    })
  );

  return `
    <div class="turmas-grid">
      ${anos.map((a) => `
        <div class="turma-card-prof" data-ano="${esc(a.ano)}">
          <div class="turma-card-prof-header">
            <div class="turma-card-prof-icon">${esc(a.ano.charAt(0))}</div>
            <div class="turma-card-prof-info">
              <div class="turma-card-prof-titulo">${esc(a.ano)}</div>
              <div class="turma-card-prof-sub">${a.totalAlunos} aluno(s)</div>
            </div>
          </div>
          <div class="turma-card-prof-stats">
            <div class="turma-card-prof-stat"><div class="valor">${a.totalAtividades}</div><div class="label">Atividades</div></div>
            <div class="turma-card-prof-stat"><div class="valor">${a.totalEnvios}</div><div class="label">Entregas</div></div>
            <div class="turma-card-prof-stat"><div class="valor">${a.totalPendentes}</div><div class="label">Pendentes</div></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ============================================================
   DETALHE DO ANO — mostra turnos e tipos
   ============================================================ */
async function abrirDetalheAno(ano) {
  const turnos = TURNOS[ano] || [];
  let cards = "";

  for (const turno of turnos) {
    const tipos = TIPOS[turno] || [];
    for (const tipo of tipos) {
      const codigo = codigoTurma(ano, turno, tipo);
      const alunos = await api(`/api/alunos/lista?turma=${encodeURIComponent(codigo)}`).catch(() => []);

      cards += `
        <div class="turma-card-prof" data-turma-detalhe="${esc(codigo)}" style="margin-bottom:12px">
          <div class="turma-card-prof-header">
            <div class="turma-card-prof-icon" style="background:${tipo === "Técnico" ? "linear-gradient(135deg,#7c3aed,#a78bfa)" : "linear-gradient(135deg,#1e3c72,#2a5298)"}">
              ${tipo === "Técnico" ? "T" : "R"}
            </div>
            <div class="turma-card-prof-info">
              <div class="turma-card-prof-titulo">${esc(ano)} ${tipo === "Técnico" ? "— Técnico" : "— Regular"}</div>
              <div class="turma-card-prof-sub">${turno} • ${alunos.length} aluno(s)</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;inset:0;background:rgba(15,28,56,0.75);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto";
  modal.innerHTML = `
    <div style="background:white;border-radius:22px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;padding:26px;position:relative">
      <button class="fechar-detalhe-ano" style="position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:none;background:#f5f7fa;cursor:pointer;font-size:1rem">✕</button>

      <h2 style="color:#1e3c72;font-size:1.3rem;margin:0 0 6px">${esc(ano)}</h2>
      <p style="font-size:0.82rem;color:#8895a7;margin-bottom:20px">Escolha o turno e o tipo de turma</p>

      ${cards}
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector(".fechar-detalhe-ano").onclick = () => modal.remove();
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

  // Bind: clique num card → abre a turma
  modal.querySelectorAll("[data-turma-detalhe]").forEach((c) => {
    c.addEventListener("click", () => {
      const codigo = c.dataset.turmaDetalhe;
      modal.remove();
      abrirDetalheTurma(codigo);
    });
  });
}

/* ============================================================
   DETALHE DA TURMA — mostra alunos
   ============================================================ */
async function abrirDetalheTurma(codigo) {
  mostrarLoading("Carregando...");
  try {
    const alunos = await api(`/api/alunos/lista?turma=${encodeURIComponent(codigo)}`).catch(() => []);

    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;inset:0;background:rgba(15,28,56,0.75);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto";
    modal.innerHTML = `
      <div style="background:white;border-radius:22px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;padding:26px;position:relative">
        <button class="fechar-detalhe-turma" style="position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:none;background:#f5f7fa;cursor:pointer;font-size:1rem">✕</button>

        <h2 style="color:#1e3c72;font-size:1.2rem;margin:0 0 6px">${esc(codigo)}</h2>
        <p style="font-size:0.82rem;color:#8895a7;margin-bottom:18px">${alunos.length} aluno(s)</p>

        ${alunos.length ? `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${alunos.map((a) => `
              <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8fafc;border-radius:12px">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem">
                  ${esc((a.nome || "?").charAt(0))}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;color:#1e3c72;font-size:0.88rem">${esc(a.nome)}</div>
                  <div style="font-size:0.72rem;color:#8895a7">${esc(a.matricula)}</div>
                </div>
              </div>
            `).join("")}
          </div>
        ` : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhum aluno nesta turma</div>`}
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector(".fechar-detalhe-turma").onclick = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  } catch (e) {
    alert("Erro: " + e.message);
  } finally {
    esconderLoading();
  }
}

/* ============================================================
   CADASTRAR
   ============================================================ */
async function renderCadastrar() {
  // Gera todas as turmas válidas
  const todas = [];
  for (const ano of ANOS) {
    for (const turno of TURNOS[ano]) {
      for (const tipo of TIPOS[turno] || []) {
        todas.push(codigoTurma(ano, turno, tipo));
      }
    }
  }

  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">➕ Cadastrar aluno</h2>
      <form id="form-cad-aluno" class="admin-form">
        <label>Matrícula<input name="matricula" required /></label>
        <label>Nome<input name="nome" required /></label>
        <label>Turma
          <select name="turma" required>
            <option value="">Selecione</option>
            ${todas.map((t) => `<option value="${esc(t)}">${esc(nomeCompletoTurma(t))}</option>`).join("")}
          </select>
        </label>
        <button type="submit" class="admin-btn" style="width:100%">Cadastrar</button>
      </form>
    </div>
  `;
}

function bindCadastrar() {
  document.getElementById("form-cad-aluno")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Cadastrando...");
    try {
      await api("/api/turmas/" + encodeURIComponent(fd.get("turma")) + "/cadastrar", {
        method: "POST",
        body: JSON.stringify({ matricula: fd.get("matricula"), nome: fd.get("nome") }),
      });
      alert("✅ Cadastrado!");
      e.target.reset();
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });
}

/* ============================================================
   POSTAR
   ============================================================ */
async function renderPostar() {
  const todas = [];
  for (const ano of ANOS) {
    for (const turno of TURNOS[ano]) {
      for (const tipo of TIPOS[turno] || []) {
        todas.push(codigoTurma(ano, turno, tipo));
      }
    }
  }

  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">➕ Nova atividade</h2>
      <form id="f-atividade" class="admin-form">
        <label>Título<input name="titulo" required /></label>
        <label>Turma
          <select name="turma" required>
            <option value="">Selecione</option>
            ${todas.map((t) => `<option value="${esc(t)}">${esc(nomeCompletoTurma(t))}</option>`).join("")}
          </select>
        </label>
        <label>Descrição<textarea name="descricao"></textarea></label>
        <label>Prazo<input type="datetime-local" name="prazo" /></label>
        <button type="submit" class="admin-btn" style="width:100%">Postar</button>
      </form>
    </div>
  `;
}

function bindPostar() {
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
        }),
      });
      alert("✅ Postado!");
      e.target.reset();
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });
}

/* ============================================================
   ENTREGAS — com preview de arquivo
   ============================================================ */
async function renderEntregas() {
  const envios = await api("/api/atividades/envios/listar").catch(() => []);

  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">📥 Entregas (${envios.length})</h2>
      ${envios.length ? `
        <div style="display:flex;flex-direction:column;gap:14px">
          ${envios.map((e) => `
            <div style="padding:16px;background:#f8fafc;border-radius:14px;border-left:4px solid #2a5298">
              <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
                <div style="flex:1;min-width:200px">
                  <div style="font-weight:700;color:#1e3c72;font-size:0.95rem;margin-bottom:4px">${esc(e.titulo)}</div>
                  <div style="font-size:0.78rem;color:#8895a7">
                    <strong>${esc(e.aluno_nome)}</strong> • ${esc(e.turma)} • ${fmtData(e.criado_em)}
                  </div>
                </div>
                <span style="padding:4px 10px;border-radius:8px;background:#eef3fb;color:#2a5298;font-size:0.68rem;font-weight:700;text-transform:uppercase">
                  ${esc(e.status)}
                </span>
              </div>

              ${e.descricao ? `<div style="font-size:0.85rem;color:#4a5568;margin-top:10px;line-height:1.5">${esc(e.descricao)}</div>` : ""}

              ${e.arquivo_url ? `
                <div style="margin-top:12px;padding:12px;background:white;border-radius:10px;border:1px solid #e6e9ef">
                  <div style="font-size:0.72rem;color:#8895a7;font-weight:700;text-transform:uppercase;margin-bottom:8px">📎 Anexo enviado</div>
                  ${e.arquivo_tipo?.startsWith("image/") ? `
                    <img src="${esc(e.arquivo_url)}" alt="" style="width:100%;max-height:320px;object-fit:contain;border-radius:8px;background:#f5f7fa" onerror="this.style.display='none'" />
                    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
                      <a href="${esc(e.arquivo_url)}" target="_blank" style="padding:8px 14px;background:#2a5298;color:white;border-radius:8px;text-decoration:none;font-size:0.78rem;font-weight:700">🔍 Abrir imagem</a>
                      <a href="${esc(e.arquivo_url)}" download style="padding:8px 14px;background:#eef3fb;color:#2a5298;border-radius:8px;text-decoration:none;font-size:0.78rem;font-weight:700">⬇️ Baixar</a>
                    </div>
                  ` : e.arquivo_tipo?.startsWith("video/") ? `
                    <video src="${esc(e.arquivo_url)}" controls style="width:100%;max-height:320px;border-radius:8px;background:#000"></video>
                    <div style="margin-top:10px">
                      <a href="${esc(e.arquivo_url)}" target="_blank" style="padding:8px 14px;background:#2a5298;color:white;border-radius:8px;text-decoration:none;font-size:0.78rem;font-weight:700">🔍 Abrir vídeo</a>
                    </div>
                  ` : `
                    <div style="display:flex;align-items:center;gap:10px;padding:12px;background:#f5f7fa;border-radius:8px">
                      <div style="font-size:1.8rem">📄</div>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:0.82rem;font-weight:600;color:#1e3c72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.arquivo_nome || "arquivo")}</div>
                        <div style="font-size:0.7rem;color:#8895a7">${e.arquivo_tipo || ""}</div>
                      </div>
                      <a href="${esc(e.arquivo_url)}" target="_blank" style="padding:8px 14px;background:#2a5298;color:white;border-radius:8px;text-decoration:none;font-size:0.78rem;font-weight:700;white-space:nowrap">🔍 Abrir</a>
                    </div>
                  `}
                </div>
              ` : ""}
            </div>
          `).join("")}
        </div>
      ` : `<div style="text-align:center;padding:32px;color:#8895a7">Nenhuma entrega ainda</div>`}
    </div>
  `;
}

/* ============================================================
   DESEMPENHO
   ============================================================ */
async function renderDesempenhoTurmas() {
  const anos = await Promise.all(
    ANOS.map(async (ano) => {
      let totalAlunos = 0;
      for (const turno of TURNOS[ano]) {
        for (const tipo of TIPOS[turno] || []) {
          const codigo = codigoTurma(ano, turno, tipo);
          const alunos = await api(`/api/alunos/lista?turma=${encodeURIComponent(codigo)}`).catch(() => []);
          totalAlunos += alunos.length;
        }
      }
      return { ano, totalAlunos };
    })
  );

  return `
    <div class="turmas-grid">
      ${anos.map((t) => `
        <div class="turma-card-prof" data-ano-desemp="${esc(t.ano)}">
          <div class="turma-card-prof-header">
            <div class="turma-card-prof-icon">${esc(t.ano.charAt(0))}</div>
            <div class="turma-card-prof-info">
              <div class="turma-card-prof-titulo">${esc(t.ano)}</div>
              <div class="turma-card-prof-sub">${t.totalAlunos} aluno(s)</div>
            </div>
          </div>
          <div style="font-size:0.82rem;color:#2a5298;font-weight:700;margin-top:8px">📊 Ver desempenho →</div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ============================================================
   DICAS
   ============================================================ */
async function renderDicas() {
  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">💡 Dicas pedagógicas</h2>
      <div style="padding:16px;background:#eef3fb;border-radius:14px;border-left:4px solid #2a5298;margin-bottom:12px">
        <div style="font-weight:700;color:#1e3c72;margin-bottom:4px">Use atividades variadas</div>
        <div style="font-size:0.85rem;color:#1e3c72;opacity:0.85">Combine exercícios, projetos e avaliações.</div>
      </div>
      <div style="padding:16px;background:#eef3fb;border-radius:14px;border-left:4px solid #2a5298">
        <div style="font-weight:700;color:#1e3c72;margin-bottom:4px">Feedback rápido</div>
        <div style="font-size:0.85rem;color:#1e3c72;opacity:0.85">Corrija e comente as entregas em até 48h.</div>
      </div>
    </div>
  `;
}

/* ============================================================
   BIND
   ============================================================ */
function bind(aba) {
  if (aba === "cadastrar")  bindCadastrar();
  if (aba === "postar")     bindPostar();

  if (aba === "turmas") {
    document.querySelectorAll("[data-ano]").forEach((c) => {
      c.addEventListener("click", () => abrirDetalheAno(c.dataset.ano));
    });
  }
  if (aba === "desempenho") {
    document.querySelectorAll("[data-ano-desemp]").forEach((c) => {
      c.addEventListener("click", () => abrirDetalheAno(c.dataset.anoDesemp));
    });
  }
}

carregar("turmas");


/* ============================================================
   EXPOR NO WINDOW (para o menu-delegation.js)
   ============================================================ */
if (typeof carregar === 'function') window.carregar = carregar;
if (typeof titulos !== 'undefined') window.titulos = titulos;
