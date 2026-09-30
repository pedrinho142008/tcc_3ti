import { api, esc, fmtData, mostrarLoading, esconderLoading, calcularMedias } from "/assets/js/shared.js";

const TURMAS = ["1º Ano A", "1º Ano T.I", "2º Ano A", "2º Ano T.I", "3º Ano A", "3º Ano T.I"];

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

const titulos = {
  turmas:     ["Minhas turmas",         "Acompanhe suas turmas"],
  cadastrar:  ["Cadastrar alunos",      "Adicione alunos à sua turma"],
  postar:     ["Postar atividade",      "Envie uma nova atividade"],
  entregas:   ["Entregas dos alunos",   "Veja o que os alunos enviaram"],
  desempenho: ["Desempenho",            "Análise de desempenho"],
  dicas:      ["Dicas pedagógicas",     "Sugestões baseadas nos dados"],
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
  el.innerHTML = `<div class="card-painel" style="text-align:center"><p style="color:#8895a7">Carregando...</p></div>`;
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
    console.error("Erro:", e);
    el.innerHTML = `<div class="card-painel" style="color:#c53030">Erro: ${esc(e.message)}</div>`;
  }
}

async function renderTurmas() {
  const todasAtividades = await api("/api/classroom/atividades").catch(() => []);

  const turmasInfo = await Promise.all(
    TURMAS.map(async (t) => {
      const alunos = await api(`/api/alunos/lista?turma=${encodeURIComponent(t)}`).catch(() => []);
      const atividades = todasAtividades.filter((a) => a.turma === t);
      const envios = await api(`/api/atividades/envios/listar?turma=${encodeURIComponent(t)}`).catch(() => []);
      const pendentes = Math.max(0, alunos.length - new Set(envios.map((e) => e.aluno_matricula)).size);
      return { turma: t, alunos, atividades, envios, pendentes };
    })
  );

  return `
    <div class="turmas-grid">
      ${turmasInfo.map((t) => `
        <div class="turma-card-prof" data-turma="${esc(t.turma)}">
          <div class="turma-card-prof-header">
            <div class="turma-card-prof-icon">${esc(t.turma.charAt(0))}</div>
            <div class="turma-card-prof-info">
              <div class="turma-card-prof-titulo">${esc(t.turma)}</div>
              <div class="turma-card-prof-sub">${t.alunos.length} aluno(s)</div>
            </div>
          </div>
          <div class="turma-card-prof-stats">
            <div class="turma-card-prof-stat">
              <div class="valor">${t.atividades.length}</div>
              <div class="label">Atividades</div>
            </div>
            <div class="turma-card-prof-stat">
              <div class="valor">${t.envios.length}</div>
              <div class="label">Entregas</div>
            </div>
            <div class="turma-card-prof-stat">
              <div class="valor">${t.pendentes}</div>
              <div class="label">Pendentes</div>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function renderCadastrar() {
  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">➕ Cadastrar aluno</h2>
      <form id="form-cad-aluno" class="admin-form">
        <label>Matrícula
          <input name="matricula" required placeholder="202430395866" />
        </label>
        <label>Nome completo
          <input name="nome" required placeholder="PEDRO VICTOR" />
        </label>
        <label>Turma
          <select name="turma" required>
            <option value="">Selecione</option>
            ${TURMAS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
        </label>
        <button type="submit" class="admin-btn" style="width:100%">Cadastrar</button>
      </form>
    </div>

    <div class="card-painel">
      <h2 class="card-painel-titulo">📊 Importar CSV</h2>
      <p style="font-size:0.82rem;color:#5a6472;margin-bottom:14px">
        Arquivo com colunas: <code>matricula,nome,turma</code>
      </p>
      <div id="drop-csv" style="border:2px dashed #c7d2e0;border-radius:14px;padding:30px;text-align:center;background:#fafbfc;cursor:pointer">
        <div style="font-size:2rem;color:#8895a7">📊</div>
        <div style="font-size:0.85rem;color:#5a6472;margin-top:8px;font-weight:600">Clique para escolher o .csv</div>
      </div>
      <input type="file" id="file-csv" accept=".csv" style="display:none" />
      <div id="csv-resultado" style="margin-top:14px"></div>
    </div>
  `;
}

function bindCadastrar() {
  document.getElementById("form-cad-aluno")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Cadastrando...");
    try {
      await api("/api/alunos/cadastrar", {
        method: "POST",
        body: JSON.stringify({
          matricula: fd.get("matricula"),
          nome: fd.get("nome"),
          turma: fd.get("turma"),
        }),
      });
      alert("✅ Aluno cadastrado!");
      e.target.reset();
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      esconderLoading();
    }
  });

  const drop = document.getElementById("drop-csv");
  const file = document.getElementById("file-csv");

  drop?.addEventListener("click", () => file.click());
  file?.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    mostrarLoading("Importando...");
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      const r = await fetch("/api/alunos/importar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro);
      document.getElementById("csv-resultado").innerHTML =
        `<div style="padding:14px;background:#d1fae5;border-radius:12px;color:#065f46">✅ ${data.importados} alunos importados</div>`;
    } catch (err) {
      document.getElementById("csv-resultado").innerHTML =
        `<div style="padding:14px;background:#fee2e2;border-radius:12px;color:#991b1b">❌ ${esc(err.message)}</div>`;
    } finally {
      esconderLoading();
      file.value = "";
    }
  });
}

async function renderPostar() {
  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">➕ Nova atividade</h2>
      <form id="f-atividade" class="admin-form">
        <label>Título<input name="titulo" required /></label>
        <label>Turma
          <select name="turma" required>
            <option value="">Selecione</option>
            ${TURMAS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
        </label>
        <label>Descrição<textarea name="descricao"></textarea></label>
        <label>Prazo<input type="datetime-local" name="prazo" /></label>
        <button type="submit" class="admin-btn" style="width:100%">Postar atividade</button>
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
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      esconderLoading();
    }
  });
}

async function renderEntregas() {
  const envios = await api("/api/atividades/envios/listar").catch(() => []);
  return `
    <div class="card-painel">
      <h2 class="card-painel-titulo">📥 Entregas (${envios.length})</h2>
      ${envios.length ? `<div style="display:flex;flex-direction:column;gap:12px">${envios.map((e) => `
        <div style="padding:14px;background:#f8fafc;border-radius:14px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div style="font-weight:700;color:#1e3c72">${esc(e.titulo)}</div>
            <span style="padding:4px 10px;border-radius:8px;background:#eef3fb;color:#2a5298;font-size:0.68rem;font-weight:700;text-transform:uppercase">${esc(e.status)}</span>
          </div>
          <div style="font-size:0.75rem;color:#8895a7;margin-top:4px">
            <strong>${esc(e.aluno_nome)}</strong> • ${esc(e.turma)} • ${fmtData(e.criado_em)}
          </div>
        </div>
      `).join("")}</div>` : `<div style="text-align:center;padding:30px;color:#8895a7">Nenhuma entrega</div>`}
    </div>
  `;
}

async function renderDesempenhoTurmas() {
  const turmasInfo = await Promise.all(
    TURMAS.map(async (t) => {
      const alunos = await api(`/api/alunos/lista?turma=${encodeURIComponent(t)}`).catch(() => []);
      return { turma: t, alunos };
    })
  );

  return `
    <div class="turmas-grid">
      ${turmasInfo.map((t) => `
        <div class="turma-card-prof" data-turma-desemp="${esc(t.turma)}">
          <div class="turma-card-prof-header">
            <div class="turma-card-prof-icon">${esc(t.turma.charAt(0))}</div>
            <div class="turma-card-prof-info">
              <div class="turma-card-prof-titulo">${esc(t.turma)}</div>
              <div class="turma-card-prof-sub">${t.alunos.length} aluno(s)</div>
            </div>
          </div>
          <div style="font-size:0.82rem;color:#2a5298;font-weight:700;margin-top:8px">📊 Ver desempenho →</div>
        </div>
      `).join("")}
    </div>
  `;
}

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

function bind(aba) {
  if (aba === "cadastrar")  bindCadastrar();
  if (aba === "postar")     bindPostar();
  if (aba === "turmas") {
    document.querySelectorAll("[data-turma]").forEach((c) => {
      c.addEventListener("click", () => {
        document.querySelector('[data-aba="desempenho"]')?.click();
      });
    });
  }
  if (aba === "desempenho") {
    document.querySelectorAll("[data-turma-desemp]").forEach((c) => {
      c.addEventListener("click", () => {
        alert("Em breve: detalhes de " + c.dataset.turmaDesemp);
      });
    });
  }
}

carregar("turmas");


/* Expor no window para o menu-delegation */
if (typeof carregar === 'function') window.carregar = carregar;
if (typeof titulos !== 'undefined') window.titulos = titulos;
