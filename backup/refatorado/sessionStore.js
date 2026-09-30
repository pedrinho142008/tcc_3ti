const sessoes = new Map();
const SESSAO_TTL = 4 * 60 * 60 * 1000;
const SESSAO_REUSE_MS = 60 * 1000;

export function setSessao(matricula, dados) {
  sessoes.set(matricula, { ...dados, criadoEm: Date.now() });
}

export function getSessao(matricula) {
  const s = sessoes.get(matricula);
  if (!s) return null;
  if (Date.now() - s.criadoEm > SESSAO_TTL) {
    sessoes.delete(matricula);
    return null;
  }
  return s;
}

export function sessaoRecente(matricula, ms = SESSAO_REUSE_MS) {
  const s = sessoes.get(matricula);
  if (!s) return null;
  if (Date.now() - s.criadoEm > ms) return null;
  return s;
}

export function touchSessao(matricula) {
  const s = sessoes.get(matricula);
  if (s) s.criadoEm = Date.now();
}

export function delSessao(matricula) {
  sessoes.delete(matricula);
}

setInterval(() => {
  const agora = Date.now();
  for (const [m, s] of sessoes.entries()) {
    if (agora - s.criadoEm > SESSAO_TTL) sessoes.delete(m);
  }
}, 10 * 60 * 1000);
