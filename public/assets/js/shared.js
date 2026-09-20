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

/* ---------- LOADING inteligente (só se demorar >600ms) ---------- */
let loadingTimer = null;

export function mostrarLoading(txt = "Carregando...") {
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    let el = document.getElementById("loading");
    if (!el) {
      el = document.createElement("div");
      el.id = "loading";
      el.className = "loading";
      el.innerHTML = `<div class="spinner"></div><p id="loading-txt"></p>`;
      document.body.appendChild(el);
    }
    document.getElementById("loading-txt").textContent = txt;
    el.classList.remove("hidden");
  }, 600);
}

export function esconderLoading() {
  clearTimeout(loadingTimer);
  const el = document.getElementById("loading");
  if (el) {
    el.classList.add("hidden");
    setTimeout(() => el.remove(), 100);
  }
}

/* ---------- NAV (opcional — usado em páginas sem script inline) ---------- */
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

/* ---------- CONFIG (URL do portal) ---------- */
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
