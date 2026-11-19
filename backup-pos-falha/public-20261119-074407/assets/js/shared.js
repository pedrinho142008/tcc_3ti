/* ====================================================================
   shared.js — utilitários compartilhados
   ==================================================================== */

export async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const txt = await r.text();
  let data;
  try { data = txt ? JSON.parse(txt) : {}; }
  catch { throw new Error("Resposta inválida do servidor"); }

  if (!r.ok) throw new Error(data.erro || `Erro ${r.status}`);
  return data;
}

export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const fmtData = (iso) => iso
  ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
  : "";

export const fmtCurta = (iso) => iso
  ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  : "";

export const periodoNome = (p) => ({
  manha: "Manhã", almoco: "Almoço", tarde: "Tarde", noite: "Noite"
}[p] || p);

/* ====================================================================
   LOADING — leve, rápido e à prova de travamento
   ==================================================================== */
let loadingTimer = null;
let loadingAtivo = false;

export function mostrarLoading(txt = "Carregando...") {
  clearTimeout(loadingTimer);
  // Só mostra se demorar mais de 200ms (evita flicker)
  loadingTimer = setTimeout(() => {
    let el = document.getElementById("loading");
    if (!el) {
      el = document.createElement("div");
      el.id = "loading";
      el.className = "loading";
      el.innerHTML = `<div class="spinner"></div><p id="loading-txt"></p>`;
      document.body.appendChild(el);
    }
    const txtEl = document.getElementById("loading-txt");
    if (txtEl) txtEl.textContent = txt;
    el.classList.remove("hidden");
    loadingAtivo = true;
  }, 200);
}

export function esconderLoading() {
  clearTimeout(loadingTimer);
  const el = document.getElementById("loading");
  if (el) {
    el.classList.add("hidden");
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 100);
  }
  loadingAtivo = false;
}

/* Força esconder (usar em casos de erro grave) */
export function forcarEsconderLoading() {
  clearTimeout(loadingTimer);
  document.querySelectorAll("#loading").forEach((el) => el.remove());
  loadingAtivo = false;
}

/* ====================================================================
   NAV
   ==================================================================== */
export function initNav() {
  const btn = document.querySelector(".menu-btn");
  const links = document.querySelector(".nav-links");
  if (!btn || !links) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    links.classList.toggle("open");
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });

  document.addEventListener("click", (e) => {
    if (!links.classList.contains("open")) return;
    if (btn.contains(e.target) || links.contains(e.target)) return;
    links.classList.remove("open");
  });
}

/* ====================================================================
   CONFIG
   ==================================================================== */
export async function initConfig() {
  try {
    const cfg = await api("/api/config");
    document.querySelectorAll("[data-portal]").forEach((el) => {
      el.href = cfg.portalEstudante;
      el.target = "_blank";
      el.rel = "noopener";
    });
    return cfg;
  } catch {
    return null;
  }
}

/* ====================================================================
   CÁLCULO DE MÉDIAS
   ==================================================================== */
export function calcularMedias(boletim, modo = "B") {
  const disciplinas = boletim?.disciplinas || [];
  if (!Array.isArray(disciplinas) || disciplinas.length === 0) {
    return { disciplinas: [], media: null };
  }

  const comMedia = disciplinas.map((d) => {
    const vals = [d.bim1, d.bim2, d.bim3, d.bim4]
      .map((n) => parseFloat(String(n || "").replace(",", ".")))
      .filter((n) => !isNaN(n));

    const soma = vals.reduce((a, b) => a + b, 0);
    const media = vals.length > 0 ? soma / vals.length : null;

    return {
      nome: d.nome || "—",
      professor: d.professor || "—",
      notas: vals,
      media: media,
    };
  });

  if (modo === "A") {
    const validas = comMedia.map((d) => d.media || 0);
    const media = validas.length > 0
      ? validas.reduce((a, b) => a + b, 0) / validas.length
      : null;
    return { disciplinas: comMedia.map((d) => ({ ...d, media: d.media || 0 })), media };
  }

  if (modo === "B") {
    const validas = comMedia.filter((d) => d.media !== null && !isNaN(d.media));
    const media = validas.length > 0
      ? validas.reduce((a, b) => a + b.media, 0) / validas.length
      : null;
    return { disciplinas: comMedia, media };
  }

  const todasNotas = comMedia.flatMap((d) => d.notas);
  const media = todasNotas.length > 0
    ? todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length
    : null;
  return { disciplinas: comMedia, media };
}
