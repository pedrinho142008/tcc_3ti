/* ============================================================
   MÓDULOS — Manutenção, Mural, Merenda, Reclamações
   ============================================================ */
import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

/* ============================================================
   MANUTENÇÃO — só funcionário cria; admin resolve
   ============================================================ */
export async function renderManutencaoModulo(user) {
  const [chamados, stats] = await Promise.all([
    api("/api/manutencao").catch(() => []),
    api("/api/manutencao/stats").catch(() => ({ total: 0, pendente: 0, resolvido: 0 })),
  ]);

  const ehAdmin = user?.tipo === "admin";

  return `
    <div class="stats-grid">
      <div class="stat-mini"><div class="valor">${stats.total}</div><div class="label">Total</div></div>
      <div class="stat-mini amarelo"><div class="valor">${stats.pendente}</div><div class="label">Pendentes</div></div>
      <div class="stat-mini verde"><div class="valor">${stats.resolvido}</div><div class="label">Resolvidos</div></div>
    </div>

    ${!ehAdmin ? `
      <div class="item-card" style="background:#f8fafc">
        <div class="item-card-titulo">➕ Solicitar manutenção</div>
        <form id="form-manutencao" class="admin-form" style="margin-top:12px">
          <label>Local
            <input name="local" required placeholder="Ex: Sala 03, Banheiro masculino..." />
          </label>
          <label>Problema
            <input name="problema" required placeholder="Ex: Ventilador quebrado" />
          </label>
          <label>Categoria
            <select name="categoria">
              <option value="geral">Geral</option>
              <option value="eletrica">Elétrica</option>
              <option value="hidraulica">Hidráulica</option>
              <option value="estrutura">Estrutura</option>
              <option value="limpeza">Limpeza</option>
              <option value="informatica">Informática</option>
              <option value="moveis">Móveis</option>
            </select>
          </label>
          <label>Prioridade
            <select name="prioridade">
              <option value="baixa">Baixa</option>
              <option value="normal" selected>Normal</option>
              <option value="urgente">🚨 Urgente</option>
            </select>
          </label>
          <label>Descrição
            <textarea name="descricao" placeholder="Detalhes do problema..."></textarea>
          </label>
          <button type="submit" class="btn-mini azul" style="width:100%;padding:14px">Enviar chamado</button>
        </form>
      </div>
    ` : ""}

    <h3 style="font-size:1rem;color:#1e3c72;margin:24px 0 12px">📋 Chamados (${chamados.length})</h3>
    <div id="lista-manutencao">
      ${chamados.length ? chamados.map((c) => renderManutencaoItem(c, ehAdmin)).join("") : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhum chamado ainda</div>`}
    </div>
  `;
}

function renderManutencaoItem(c, ehAdmin) {
  const classe = c.status === "pendente" ? "pendente" : "resolvido";
  const urgente = c.prioridade === "urgente" ? "urgente" : "";
  const labelStatus = c.status === "pendente" ? "🟡 Pendente" : "🟢 Resolvido";

  return `
    <div class="item-card ${classe} ${urgente}">
      <div class="item-card-titulo">
        ${c.prioridade === "urgente" ? "🚨" : "🔧"} ${esc(c.problema)}
        <span class="status-pill ${classe}">${labelStatus}</span>
      </div>
      <div class="item-card-meta">
        <span>📍 ${esc(c.local)}</span>
        <span>👤 ${esc(c.autor_nome || "—")} (${esc(c.autor_tipo || "—")})</span>
        <span>📅 ${fmtData(c.criado_em)}</span>
      </div>
      ${c.descricao ? `<div class="item-card-texto">${esc(c.descricao)}</div>` : ""}
      ${c.foto_url ? `<img src="${esc(c.foto_url)}" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:10px" />` : ""}
      ${ehAdmin && c.status === "pendente" ? `
        <div class="item-card-acoes">
          <button class="btn-mini verde btn-resolver-manutencao" data-id="${c.id}">✓ Resolver</button>
        </div>
      ` : ""}
      ${c.status === "resolvido" && c.observacao_resolucao ? `
        <div style="font-size:0.78rem;color:#065f46;font-style:italic;margin-top:6px">"${esc(c.observacao_resolucao)}"</div>
      ` : ""}
    </div>
  `;
}

export function bindManutencaoModulo() {
  document.getElementById("form-manutencao")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Enviando...");
    try {
      await api("/api/manutencao", {
        method: "POST",
        body: JSON.stringify({
          local: fd.get("local"),
          problema: fd.get("problema"),
          categoria: fd.get("categoria"),
          prioridade: fd.get("prioridade"),
          descricao: fd.get("descricao"),
        }),
      });
      alert("✅ Chamado aberto!");
      window.__recarregarModulo?.("manutencao");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });

  document.querySelectorAll(".btn-resolver-manutencao").forEach((b) => {
    b.addEventListener("click", async () => {
      const obs = prompt("Observação da resolução (opcional):");
      mostrarLoading();
      try {
        await api(`/api/manutencao/${b.dataset.id}/resolver`, {
          method: "PUT",
          body: JSON.stringify({ observacao_resolucao: obs }),
        });
        window.__recarregarModulo?.("manutencao");
      } catch (err) { alert("Erro: " + err.message); }
      finally { esconderLoading(); }
    });
  });
}

/* ============================================================
   MURAL SEGMENTADO
   ============================================================ */
export async function renderMuralSegmentadoModulo(user) {
  const [avisos, publicos, turmas] = await Promise.all([
    api("/api/mural").catch(() => []),
    api("/api/mural/publicos").catch(() => []),
    api("/api/mural/turmas").catch(() => []),
  ]);

  const ehAdmin = user?.tipo === "admin";
  const ehProf = user?.tipo === "professor";

  const categoriasAdmin = [
    { v: "aviso", l: "📢 Aviso" },
    { v: "urgente", l: "🚨 Urgente" },
    { v: "evento", l: "🎉 Evento" },
    { v: "reuniao", l: "🤝 Reunião" },
    { v: "feriado", l: "🏖️ Feriado" },
  ];

  const categoriasProf = [
    { v: "prova", l: "📝 Prova" },
  ];

  const categorias = ehAdmin ? categoriasAdmin : ehProf ? categoriasProf : [];

  return `
    <div class="item-card" style="background:#f8fafc">
      <div class="item-card-titulo">➕ Novo aviso no mural</div>
      <form id="form-mural" class="admin-form" style="margin-top:12px">
        <label>Título
          <input name="titulo" required placeholder="Ex: Reunião de pais" />
        </label>
        <label>Texto
          <textarea name="texto" required placeholder="Detalhes do aviso..."></textarea>
        </label>

        <label>Categoria
          <select name="categoria">
            ${categorias.map((c) => `<option value="${c.v}">${c.l}</option>`).join("")}
          </select>
        </label>

        ${ehAdmin ? `
          <label>Enviar para</label>
          <div class="publico-grid">
            ${publicos.map((p) => `
              <label class="publico-check">
                <input type="checkbox" name="publico" value="${esc(p.valor)}" ${p.valor === "todos" ? "checked" : ""} />
                <span>${esc(p.label)}</span>
              </label>
            `).join("")}
          </div>
        ` : ""}

        ${ehProf ? `
          <label>Enviar para as turmas</label>
          <div class="publico-grid">
            ${turmas.map((t) => `
              <label class="publico-check">
                <input type="checkbox" name="publico_turma" value="${esc(t)}" />
                <span>${esc(t)}</span>
              </label>
            `).join("")}
          </div>
        ` : ""}

        <label style="display:flex;align-items:center;gap:8px;text-transform:none">
          <input type="checkbox" name="fixado" style="width:auto" /> 📌 Fixar no topo
        </label>

        <button type="submit" class="btn-mini azul" style="width:100%;padding:14px">Publicar no mural</button>
      </form>
    </div>

    <h3 style="font-size:1rem;color:#1e3c72;margin:24px 0 12px">📢 Avisos (${avisos.length})</h3>
    <div id="lista-mural">
      ${avisos.length ? avisos.map(renderMuralItem).join("") : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhum aviso</div>`}
    </div>
  `;
}

function renderMuralItem(a) {
  const classe = a.categoria === "urgente" ? "urgente" : a.categoria === "prova" ? "prova" : "";
  return `
    <div class="item-card ${classe}">
      <div class="item-card-titulo">
        ${a.fixado ? "📌" : ""} ${esc(a.titulo)}
      </div>
      <div class="item-card-meta">
        <span>👤 ${esc(a.autor_nome || "—")}</span>
        <span>📅 ${fmtData(a.criado_em)}</span>
        <span>📢 ${(a.publico || []).join(", ")} ${(a.publico_turmas || []).length ? "→ " + a.publico_turmas.join(", ") : ""}</span>
      </div>
      <div class="item-card-texto">${esc(a.texto)}</div>
      <div class="item-card-acoes">
        <button class="btn-mini vermelho btn-del-mural" data-id="${a.id}">🗑️ Excluir</button>
      </div>
    </div>
  `;
}

export function bindMuralSegmentadoModulo() {
  document.querySelectorAll('.publico-check input').forEach((c) => {
    c.addEventListener("change", () => c.closest(".publico-check").classList.toggle("ativo", c.checked));
    if (c.checked) c.closest(".publico-check").classList.add("ativo");
  });

  document.getElementById("form-mural")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const publico = [];
    e.target.querySelectorAll('input[name="publico"]:checked').forEach((c) => publico.push(c.value));

    const publico_turmas = [];
    e.target.querySelectorAll('input[name="publico_turma"]:checked').forEach((c) => publico_turmas.push(c.value));

    mostrarLoading("Publicando...");
    try {
      await api("/api/mural", {
        method: "POST",
        body: JSON.stringify({
          titulo: fd.get("titulo"),
          texto: fd.get("texto"),
          categoria: fd.get("categoria"),
          publico: publico.length ? publico : ["todos"],
          publico_turmas,
          fixado: fd.get("fixado") === "on",
        }),
      });
      alert("✅ Aviso publicado!");
      window.__recarregarModulo?.("mural-segmentado");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });

  document.querySelectorAll(".btn-del-mural").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir este aviso?")) return;
      mostrarLoading();
      try {
        await api(`/api/mural/${b.dataset.id}`, { method: "DELETE" });
        window.__recarregarModulo?.("mural-segmentado");
      } catch (err) { alert("Erro: " + err.message); }
      finally { esconderLoading(); }
    });
  });
}

/* ============================================================
   MERENDA — estatística (admin) + cadastro (merendeira)
   ============================================================ */
export async function renderMerendaModulo(user) {
  const stats = await api("/api/merenda/stats").catch(() => ({ total: 0, porPeriodo: {}, porDia: {}, refeicoes: [] }));
  const hoje = await api("/api/merenda/hoje").catch(() => null);

  const ehMerendeira = user?.cargo === "merendeira" || (user?.tipo === "funcionario" && user?.cargo === "merendeira");
  const ehAdmin = user?.tipo === "admin";

  return `
    <div class="stats-grid">
      <div class="stat-mini"><div class="valor">${stats.total}</div><div class="label">Este mês</div></div>
      <div class="stat-mini amarelo"><div class="valor">${stats.porPeriodo?.almoco || 0}</div><div class="label">Almoços</div></div>
      <div class="stat-mini azul"><div class="valor">${stats.porPeriodo?.manha || 0}</div><div class="label">Manhãs</div></div>
      <div class="stat-mini verde"><div class="valor">${Object.keys(stats.porDia || {}).length}</div><div class="label">Dias com merenda</div></div>
    </div>

    ${ehMerendeira && hoje?.pode_cadastrar ? `
      <div class="item-card" style="background:#f8fafc">
        <div class="item-card-titulo">🍽️ Cadastrar merenda de hoje (${esc(hoje.dia_nome)})</div>
        <div style="font-size:0.82rem;color:#2a5298;margin-top:6px">
          Hoje é dia do <strong>${esc(hoje.turma_hoje)}</strong>
        </div>
        <form id="form-merenda" class="admin-form" style="margin-top:12px">
          <input type="hidden" name="data" value="${esc(hoje.data)}" />
          <input type="hidden" name="turma_destino" value="${esc(hoje.turma_hoje)}" />
          <input type="hidden" name="periodo" value="almoco" />

          <label>Descrição
            <textarea name="descricao" required placeholder="Ex: Arroz, feijão, frango e salada"></textarea>
          </label>

          <label>Foto (opcional)
            <input type="url" name="foto_url" placeholder="https://exemplo.com/foto.jpg" />
          </label>

          <button type="submit" class="btn-mini azul" style="width:100%;padding:14px">Publicar merenda de hoje</button>
        </form>
      </div>
    ` : ehMerendeira ? `
      <div class="item-card">
        <div class="item-card-titulo">🍽️ Hoje (${esc(hoje?.dia_nome || "?")})</div>
        <div style="font-size:0.85rem;color:#8895a7;margin-top:6px">
          Hoje não há turma específica. Cadastre quando for dia de almoço (segunda, quarta ou sexta).
        </div>
      </div>
    ` : ""}

    <h3 style="font-size:1rem;color:#1e3c72;margin:24px 0 12px">🍽️ Merendas deste mês (${stats.refeicoes?.length || 0})</h3>
    <div>
      ${(stats.refeicoes || []).length ? stats.refeicoes.map(renderMerendaItem).join("") : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhuma merenda cadastrada este mês</div>`}
    </div>
  `;
}

function renderMerendaItem(m) {
  const labels = { manha: "☕ Manhã", almoco: "🍛 Almoço", tarde: "🥪 Tarde", noite: "🌙 Noite" };
  return `
    <div class="item-card">
      <div class="item-card-titulo">${labels[m.periodo] || m.periodo}</div>
      <div class="item-card-meta">
        <span>📅 ${fmtData(m.data)}</span>
        ${m.turma_destino ? `<span>🎓 ${esc(m.turma_destino)}</span>` : ""}
      </div>
      <div class="item-card-texto">${esc(m.descricao)}</div>
      ${m.foto_url ? `<img src="${esc(m.foto_url)}" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:8px" />` : ""}
    </div>
  `;
}

export function bindMerendaModulo() {
  document.getElementById("form-merenda")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Publicando...");
    try {
      await api("/api/meals", {
        method: "POST",
        body: JSON.stringify({
          data: fd.get("data"),
          periodo: fd.get("periodo"),
          descricao: fd.get("descricao"),
          foto_url: fd.get("foto_url") || null,
          turma_destino: fd.get("turma_destino") || null,
        }),
      });
      alert("✅ Merenda publicada!");
      window.__recarregarModulo?.("merenda");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });
}

/* ============================================================
   RECLAMAÇÕES — faxineira, porteiro, funcionário
   ============================================================ */
export async function renderReclamacoesModulo(user) {
  const [reclamacoes, stats] = await Promise.all([
    api("/api/reclamacoes").catch(() => []),
    api("/api/reclamacoes/stats").catch(() => ({ total: 0, pendente: 0, resolvido: 0 })),
  ]);

  const ehAdmin = user?.tipo === "admin";

  return `
    <div class="stats-grid">
      <div class="stat-mini"><div class="valor">${stats.total}</div><div class="label">Total</div></div>
      <div class="stat-mini amarelo"><div class="valor">${stats.pendente}</div><div class="label">Pendentes</div></div>
      <div class="stat-mini verde"><div class="valor">${stats.resolvido}</div><div class="label">Resolvidos</div></div>
    </div>

    ${!ehAdmin ? `
      <div class="item-card" style="background:#f8fafc">
        <div class="item-card-titulo">📝 Abrir reclamação</div>
        <form id="form-reclamacao" class="admin-form" style="margin-top:12px">
          <label>Título
            <input name="titulo" required placeholder="Ex: Banheiro com vazamento" />
          </label>
          <label>Descrição
            <textarea name="descricao" placeholder="Detalhes..."></textarea>
          </label>
          <label>Categoria
            <select name="categoria">
              <option value="geral">Geral</option>
              <option value="limpeza">Limpeza</option>
              <option value="estrutura">Estrutura</option>
              <option value="seguranca">Segurança</option>
              <option value="barulho">Barulho</option>
            </select>
          </label>
          <label>Local
            <input name="local" placeholder="Ex: Corredor do 2º andar" />
          </label>
          <label>Foto (opcional)
            <input type="url" name="foto_url" placeholder="https://exemplo.com/foto.jpg" />
          </label>
          <button type="submit" class="btn-mini azul" style="width:100%;padding:14px">Enviar reclamação</button>
        </form>
      </div>
    ` : ""}

    <h3 style="font-size:1rem;color:#1e3c72;margin:24px 0 12px">📋 Reclamações (${reclamacoes.length})</h3>
    <div>
      ${reclamacoes.length ? reclamacoes.map((r) => renderReclamacaoItem(r, ehAdmin)).join("") : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhuma reclamação</div>`}
    </div>
  `;
}

function renderReclamacaoItem(r, ehAdmin) {
  const classe = r.status === "pendente" ? "pendente" : "resolvido";
  return `
    <div class="item-card ${classe}">
      <div class="item-card-titulo">
        📝 ${esc(r.titulo)}
        <span class="status-pill ${classe}">${r.status === "pendente" ? "🟡 Pendente" : "🟢 Resolvido"}</span>
      </div>
      <div class="item-card-meta">
        <span>👤 ${esc(r.autor_nome || "—")} (${esc(r.autor_cargo || "—")})</span>
        <span>📅 ${fmtData(r.criado_em)}</span>
        ${r.local ? `<span>📍 ${esc(r.local)}</span>` : ""}
      </div>
      ${r.descricao ? `<div class="item-card-texto">${esc(r.descricao)}</div>` : ""}
      ${r.foto_url ? `<img src="${esc(r.foto_url)}" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:8px" />` : ""}
      ${ehAdmin && r.status === "pendente" ? `
        <div class="item-card-acoes" style="margin-top:10px">
          <button class="btn-mini verde btn-resolver-reclamacao" data-id="${r.id}">✓ Resolver</button>
        </div>
      ` : ""}
    </div>
  `;
}

export function bindReclamacoesModulo() {
  document.getElementById("form-reclamacao")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Enviando...");
    try {
      await api("/api/reclamacoes", {
        method: "POST",
        body: JSON.stringify({
          titulo: fd.get("titulo"),
          descricao: fd.get("descricao"),
          categoria: fd.get("categoria"),
          local: fd.get("local"),
          foto_url: fd.get("foto_url") || null,
        }),
      });
      alert("✅ Reclamação enviada!");
      window.__recarregarModulo?.("reclamacoes");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });

  document.querySelectorAll(".btn-resolver-reclamacao").forEach((b) => {
    b.addEventListener("click", async () => {
      const obs = prompt("Observação (opcional):");
      mostrarLoading();
      try {
        await api(`/api/reclamacoes/${b.dataset.id}/resolver`, {
          method: "PUT",
          body: JSON.stringify({ observacao_resolucao: obs }),
        });
        window.__recarregarModulo?.("reclamacoes");
      } catch (err) { alert("Erro: " + err.message); }
      finally { esconderLoading(); }
    });
  });
}

/* ============================================================
   AGENDA SEMANAL (admin cria, aluno vê)
   ============================================================ */
export async function renderAgendaAdminModulo() {
  const aulas = await api("/api/agenda").catch(() => []);
  const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

  return `
    <div class="item-card" style="background:#f8fafc">
      <div class="item-card-titulo">➕ Colar horários</div>
      <form id="form-agenda-paste" class="admin-form" style="margin-top:12px">
        <label>Ano
          <select name="ano" required>
            <option value="1º Ano">1º Ano</option>
            <option value="2º Ano">2º Ano</option>
            <option value="3º Ano" selected>3º Ano</option>
          </select>
        </label>
        <label>Turno
          <select name="turno" required>
            <option value="Matutino">Matutino</option>
            <option value="Vespertino">Vespertino</option>
            <option value="Noturno">Noturno</option>
          </select>
        </label>
        <label>Tipo
          <select name="tipo" required>
            <option value="Regular">Regular</option>
            <option value="Técnico">Técnico</option>
          </select>
        </label>
        <label>Cole as aulas (uma por linha)
          <textarea name="texto" required placeholder="1,07:00,Matemática,João Silva&#10;1,07:50,Português,Maria Santos&#10;2,07:00,História,Carlos Lima"></textarea>
          <small style="display:block;margin-top:6px;font-size:0.72rem;color:#8895a7;text-transform:none;letter-spacing:normal">
            Formato: <strong>dia,horario,materia,professor[,sala]</strong><br>
            Dia: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta
          </small>
        </label>
        <button type="submit" class="btn-mini azul" style="width:100%;padding:14px">Importar horários</button>
      </form>
    </div>

    <h3 style="font-size:1rem;color:#1e3c72;margin:24px 0 12px">📅 Aulas cadastradas (${aulas.length})</h3>
    <div>
      ${aulas.length ? aulas.map((a) => `
        <div class="item-card">
          <div class="item-card-titulo">${esc(a.materia)} — ${esc(a.professor)}</div>
          <div class="item-card-meta">
            <span>${esc(a.ano)} • ${esc(a.turno)} • ${esc(a.tipo)}</span>
            <span>📅 ${dias[a.dia_semana - 1]}</span>
            <span>🕐 ${esc(a.horario)}</span>
            ${a.sala ? `<span>🚪 ${esc(a.sala)}</span>` : ""}
          </div>
          <div class="item-card-acoes">
            <button class="btn-mini vermelho btn-del-aula" data-id="${a.id}">Excluir</button>
          </div>
        </div>
      `).join("") : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhuma aula cadastrada</div>`}
    </div>
  `;
}

export function bindAgendaAdminModulo() {
  document.getElementById("form-agenda-paste")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mostrarLoading("Importando...");
    try {
      const r = await api("/api/agenda/paste", {
        method: "POST",
        body: JSON.stringify({
          ano: fd.get("ano"),
          turno: fd.get("turno"),
          tipo: fd.get("tipo"),
          texto: fd.get("texto"),
        }),
      });
      alert(`✅ ${r.adicionadas} aulas importadas!`);
      window.__recarregarModulo?.("agenda");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });

  document.querySelectorAll(".btn-del-aula").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir esta aula?")) return;
      mostrarLoading();
      try {
        await api(`/api/agenda/${b.dataset.id}`, { method: "DELETE" });
        window.__recarregarModulo?.("agenda");
      } catch (err) { alert("Erro: " + err.message); }
      finally { esconderLoading(); }
    });
  });
}
