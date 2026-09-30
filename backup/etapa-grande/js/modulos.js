/* ============================================================
   MÓDULOS — Manutenção, Documentos e Mural
   ============================================================ */
import { api, esc, fmtData, mostrarLoading, esconderLoading } from "/assets/js/shared.js";

/* ============================================================
   MANUTENÇÃO
   ============================================================ */
export async function renderManutencao() {
  const [chamados, stats] = await Promise.all([
    api("/api/manutencao").catch(() => []),
    api("/api/manutencao/stats").catch(() => ({ total: 0, pendente: 0, em_manutencao: 0, resolvido: 0 })),
  ]);

  return `
    <div class="stats-grid">
      <div class="stat-mini"><div class="valor">${stats.total}</div><div class="label">Total</div></div>
      <div class="stat-mini amarelo"><div class="valor">${stats.pendente}</div><div class="label">Pendentes</div></div>
      <div class="stat-mini azul"><div class="valor">${stats.em_manutencao}</div><div class="label">Em manutenção</div></div>
      <div class="stat-mini verde"><div class="valor">${stats.resolvido}</div><div class="label">Resolvidos</div></div>
    </div>

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

    <h3 style="font-size:1rem;color:#1e3c72;margin:24px 0 12px">📋 Chamados</h3>
    <div id="lista-manutencao">
      ${chamados.length ? chamados.map(renderManutencaoItem).join("") : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhum chamado ainda</div>`}
    </div>
  `;
}

function renderManutencaoItem(c) {
  const classe = c.status === "pendente" ? "pendente" : c.status === "em_manutencao" ? "andamento" : "resolvido";
  const urgente = c.prioridade === "urgente" ? "urgente" : "";
  const labelStatus = c.status === "pendente" ? "🟡 Pendente" : c.status === "em_manutencao" ? "🔵 Em manutenção" : "🟢 Resolvido";

  return `
    <div class="item-card ${classe} ${urgente}">
      <div class="item-card-titulo">
        ${c.prioridade === "urgente" ? "🚨" : "🔧"} ${esc(c.problema)}
        <span class="status-pill ${classe}">${labelStatus}</span>
      </div>
      <div class="item-card-meta">
        <span>📍 ${esc(c.local)}</span>
        <span>👤 ${esc(c.autor_nome || "—")}</span>
        <span>📅 ${fmtData(c.criado_em)}</span>
      </div>
      ${c.descricao ? `<div class="item-card-texto">${esc(c.descricao)}</div>` : ""}
      ${c.foto_url ? `<img src="${esc(c.foto_url)}" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:10px" />` : ""}
      ${c.status !== "resolvido" ? `
        <div class="item-card-acoes">
          ${c.status === "pendente" ? `<button class="btn-mini laranja btn-mudar-status" data-id="${c.id}" data-status="em_manutencao">▶ Iniciar</button>` : ""}
          <button class="btn-mini verde btn-mudar-status" data-id="${c.id}" data-status="resolvido">✓ Resolvido</button>
        </div>
      ` : c.observacao_resolucao ? `
        <div style="font-size:0.78rem;color:#065f46;font-style:italic;margin-top:6px">"${esc(c.observacao_resolucao)}"</div>
      ` : ""}
    </div>
  `;
}

export function bindManutencao() {
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

  document.querySelectorAll(".btn-mudar-status").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const status = b.dataset.status;
      const obs = status === "resolvido" ? prompt("Observação (opcional):") : null;
      mostrarLoading();
      try {
        await api(`/api/manutencao/${id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status, observacao_resolucao: obs }),
        });
        window.__recarregarModulo?.("manutencao");
      } catch (err) { alert("Erro: " + err.message); }
      finally { esconderLoading(); }
    });
  });
}

/* ============================================================
   DOCUMENTOS
   ============================================================ */
export async function renderDocumentos() {
  const solicitacoes = await api("/api/documentos/todas").catch(() => []);
  const stats = await api("/api/documentos/stats").catch(() => ({ pendente: 0, preparando: 0, pronto: 0 }));

  return `
    <div class="stats-grid">
      <div class="stat-mini amarelo"><div class="valor">${stats.pendente}</div><div class="label">Pendentes</div></div>
      <div class="stat-mini azul"><div class="valor">${stats.preparando}</div><div class="label">Preparando</div></div>
      <div class="stat-mini verde"><div class="valor">${stats.pronto}</div><div class="label">Prontos</div></div>
      <div class="stat-mini"><div class="valor">${stats.entregue}</div><div class="label">Entregues</div></div>
    </div>

    <h3 style="font-size:1rem;color:#1e3c72;margin:20px 0 12px">📄 Solicitações</h3>
    <div id="lista-documentos">
      ${solicitacoes.length ? solicitacoes.map(renderDocumentoItem).join("") : `<div style="text-align:center;padding:24px;color:#8895a7">Nenhuma solicitação</div>`}
    </div>
  `;
}

function renderDocumentoItem(s) {
  const classe = s.status === "pendente" ? "pendente" : s.status === "pronto" ? "resolvido" : "andamento";
  const labels = {
    declaracao_matricula: "Declaração de matrícula",
    declaracao_escolar: "Declaração escolar",
    historico: "Histórico escolar",
    comprovante_frequencia: "Comprovante de frequência",
    outros: "Outros",
  };

  const statusLabels = {
    pendente: "🟡 Pendente",
    preparando: "🔵 Preparando",
    pronto: "🟢 Pronto",
    entregue: "✅ Entregue",
  };

  return `
    <div class="item-card ${classe} ${s.urgente ? "urgente" : ""}">
      <div class="item-card-titulo">
        ${s.urgente ? "🚨" : "📄"} ${esc(labels[s.tipo_documento] || s.tipo_documento)}
        <span class="status-pill ${classe}">${statusLabels[s.status]}</span>
      </div>
      <div class="item-card-meta">
        <span>👤 ${esc(s.aluno_nome)}</span>
        <span>🎓 ${esc(s.aluno_turma || "—")}</span>
        <span>📅 ${fmtData(s.criado_em)}</span>
      </div>
      ${s.motivo ? `<div class="item-card-texto">Motivo: ${esc(s.motivo)}</div>` : ""}
      ${s.observacao ? `<div class="item-card-texto" style="color:#2a5298">📝 ${esc(s.observacao)}</div>` : ""}
      ${s.status !== "entregue" ? `
        <div class="item-card-acoes">
          ${s.status === "pendente" ? `<button class="btn-mini laranja btn-status-doc" data-id="${s.id}" data-status="preparando">▶ Preparar</button>` : ""}
          ${s.status === "preparando" ? `<button class="btn-mini verde btn-status-doc" data-id="${s.id}" data-status="pronto">✓ Marcar pronto</button>` : ""}
          ${s.status === "pronto" ? `<button class="btn-mini azul btn-status-doc" data-id="${s.id}" data-status="entregue">📤 Entregue ao aluno</button>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

export function bindDocumentos() {
  document.querySelectorAll(".btn-status-doc").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const status = b.dataset.status;
      let observacao = null;
      let prazo = null;

      if (status === "pronto") {
        observacao = prompt("Observação (ex: Retirar na secretaria após 14h):");
      }

      mostrarLoading();
      try {
        await api(`/api/documentos/${id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status, observacao, prazo_retirada: prazo }),
        });
        window.__recarregarModulo?.("documentos");
      } catch (err) { alert("Erro: " + err.message); }
      finally { esconderLoading(); }
    });
  });
}

/* ============================================================
   MURAL SEGMENTADO
   ============================================================ */
export async function renderMuralSegmentado() {
  const avisos = await api("/api/mural").catch(() => []);
  const publicos = await api("/api/mural/publicos").catch(() => []);

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
            <option value="aviso">📢 Aviso</option>
            <option value="urgente">🚨 Urgente</option>
            <option value="evento">🎉 Evento</option>
            <option value="prova">📝 Prova</option>
            <option value="reuniao">🤝 Reunião</option>
            <option value="feriado">🏖️ Feriado</option>
          </select>
        </label>

        <label>Enviar para (marque quem deve ver)</label>
        <div class="publico-grid">
          ${publicos.map((p) => `
            <label class="publico-check">
              <input type="checkbox" name="publico" value="${esc(p.valor)}" ${p.valor === "todos" ? "checked" : ""} />
              <span>${esc(p.label)}</span>
            </label>
          `).join("")}
        </div>

        <label style="display:flex;align-items:center;gap:8px;text-transform:none">
          <input type="checkbox" name="fixado" style="width:auto" /> 📌 Fixar no topo
        </label>

        <button type="submit" class="btn-mini azul" style="width:100%;padding:14px">Publicar no mural</button>
      </form>
    </div>

    <h3 style="font-size:1rem;color:#1e3c72;margin:24px 0 12px">📢 Avisos publicados (${avisos.length})</h3>
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
        <span>📢 ${(a.publico || []).join(", ")}</span>
      </div>
      <div class="item-card-texto">${esc(a.texto)}</div>
      <div class="item-card-acoes">
        <button class="btn-mini vermelho btn-del-mural" data-id="${a.id}">🗑️ Excluir</button>
      </div>
    </div>
  `;
}

export function bindMuralSegmentado() {
  document.querySelectorAll('.publico-check input').forEach((c) => {
    c.addEventListener("change", () => {
      c.closest(".publico-check").classList.toggle("ativo", c.checked);
    });
    if (c.checked) c.closest(".publico-check").classList.add("ativo");
  });

  document.getElementById("form-mural")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const publico = [];
    e.target.querySelectorAll('input[name="publico"]:checked').forEach((c) => publico.push(c.value));

    mostrarLoading("Publicando...");
    try {
      await api("/api/mural", {
        method: "POST",
        body: JSON.stringify({
          titulo: fd.get("titulo"),
          texto: fd.get("texto"),
          categoria: fd.get("categoria"),
          publico: publico.length ? publico : ["todos"],
          fixado: fd.get("fixado") === "on",
        }),
      });
      alert("✅ Aviso publicado!");
      window.__recarregarModulo?.("mural");
    } catch (err) { alert("Erro: " + err.message); }
    finally { esconderLoading(); }
  });

  document.querySelectorAll(".btn-del-mural").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Excluir este aviso?")) return;
      mostrarLoading();
      try {
        await api(`/api/mural/${b.dataset.id}`, { method: "DELETE" });
        window.__recarregarModulo?.("mural");
      } catch (err) { alert("Erro: " + err.message); }
      finally { esconderLoading(); }
    });
  });
}
