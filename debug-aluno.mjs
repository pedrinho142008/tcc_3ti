/**
 * debug-aluno.mjs — Diagnóstico formatado como banco de dados
 * Uso: node debug-aluno.mjs MATRICULA SENHA
 */

import { SigEducClient } from "./server/scraper/client.js";
import { parseBoletim } from "./server/scraper/boletim.js";
import { parsePerfil, parseProfessores } from "./server/scraper/professores.js";

const matricula = process.argv[2];
const senha = process.argv[3];

if (!matricula || !senha) {
  console.error("❌ Uso: node debug-aluno.mjs MATRICULA SENHA");
  process.exit(1);
}

const t0 = Date.now();
const tempo = () => `+${Date.now() - t0}ms`;

function titulo(txt) {
  console.log("\n" + "═".repeat(80));
  console.log("  " + txt);
  console.log("═".repeat(80));
}

function sub(txt) {
  console.log("\n" + "─".repeat(80));
  console.log("  " + txt);
  console.log("─".repeat(80));
}

/* Formata uma linha da tabela */
function linha(cols, larguras) {
  return "│ " + cols.map((c, i) => {
    const s = String(c ?? "").padEnd(larguras[i]).slice(0, larguras[i]);
    return s;
  }).join(" │ ") + " │";
}

function separador(larguras) {
  return "├─" + larguras.map(w => "─".repeat(w)).join("─┼─") + "─┤";
}

function topo(larguras) {
  return "┌─" + larguras.map(w => "─".repeat(w)).join("─┬─") + "─┐";
}

function base(larguras) {
  return "└─" + larguras.map(w => "─".repeat(w)).join("─┴─") + "─┘";
}

function notaCor(n) {
  const num = parseFloat(String(n).replace(",", "."));
  if (isNaN(num)) return "  —  ";
  if (num >= 7) return ` \x1b[32m${n}\x1b[0m `;   // verde
  if (num >= 6) return ` \x1b[33m${n}\x1b[0m `;   // amarelo
  return ` \x1b[31m${n}\x1b[0m `;                  // vermelho
}

(async () => {
  titulo(`🔍 DEBUG COMPLETO — ${matricula}`);
  console.log(`  Iniciado em: ${new Date().toLocaleString("pt-BR")}`);
  console.log(`  Matrícula:   ${matricula}`);
  console.log(`  Senha:       ${"*".repeat(senha.length)} (${senha.length} chars)`);

  const c = new SigEducClient();

  /* ═══════════════════════════════════════════════════════════
     PASSO 1 — LOGIN
     ═══════════════════════════════════════════════════════════ */
  sub("📋 PASSO 1 — Autenticação no SigEduc");
  try {
    const ok = await c.login(matricula, senha);
    if (!ok) {
      console.error("  ❌ Login FALHOU");
      process.exit(1);
    }
    console.log(`  ✅ Login OK (${tempo()})`);
  } catch (e) {
    console.error(`  ❌ ERRO: ${e.message}`);
    process.exit(1);
  }

  /* ═══════════════════════════════════════════════════════════
     PASSO 2 — VÍNCULOS
     ═══════════════════════════════════════════════════════════ */
  sub("📋 PASSO 2 — Vínculos disponíveis");

  const largV = [6, 42, 8, 20];
  console.log(topo(largV));
  console.log(linha(["ID", "Escola", "Ano", "Série"], largV));
  console.log(separador(largV));

  (c.vinculos || []).forEach((v) => {
    console.log(linha([v.id, v.escola || "?", v.ano || "?", v.serie || "?"], largV));
  });
  console.log(base(largV));

  await c.escolherVinculoAutomatico();
  console.log(`\n  ✅ Vínculo escolhido: ${c.vinculoAtivo} (${tempo()})`);

  /* ═══════════════════════════════════════════════════════════
     PASSO 3 — PORTAL
     ═══════════════════════════════════════════════════════════ */
  sub("📋 PASSO 3 — Portal do discente");
  let htmlPortal = "";
  try {
    htmlPortal = await c.portal();
    console.log(`  ✅ Portal OK — ${htmlPortal.length} bytes (${tempo()})`);
  } catch (e) {
    console.error(`  ❌ ERRO: ${e.message}`);
    process.exit(1);
  }

  /* ═══════════════════════════════════════════════════════════
     PASSO 4 — PERFIL
     ═══════════════════════════════════════════════════════════ */
  sub("📋 PASSO 4 — Perfil do aluno");
  const perfil = parsePerfil(htmlPortal);

  const camposPerfil = [
    ["Nome",        perfil.nome],
    ["Matrícula",   perfil.matrícula || perfil.matricula],
    ["Ano",         perfil.ano],
    ["Série",       perfil.série],
    ["Turma",       perfil.turma],
    ["Situação",    perfil.situação],
    ["E-mail",      perfil["e-mail"]],
    ["Escola",      perfil.escola],
    ["Foto",        perfil.foto_url],
  ];

  const largP = [16, 60];
  console.log(topo(largP));
  console.log(linha(["Campo", "Valor"], largP));
  console.log(separador(largP));
  camposPerfil.forEach(([k, v]) => {
    console.log(linha([k, v || "(vazio)"], largP));
  });
  console.log(base(largP));

  const professores = parseProfessores(htmlPortal);
  console.log(`\n  📚 Professores: ${Object.keys(professores).length}`);

  /* ═══════════════════════════════════════════════════════════
     PASSO 5 — BOLETIM
     ═══════════════════════════════════════════════════════════ */
  sub("📋 PASSO 5 — Boletim");
  let htmlBoletim = "";
  try {
    const tb = Date.now();
    htmlBoletim = await c.boletim();
    console.log(`  ✅ Boletim OK — ${htmlBoletim.length} bytes em ${Date.now() - tb}ms`);
  } catch (e) {
    console.error(`  ❌ ERRO: ${e.message}`);
    process.exit(1);
  }

  const boletim = parseBoletim(htmlBoletim);

  /* ═══════════════════════════════════════════════════════════
     PASSO 6 — TABELA DE NOTAS (estilo banco de dados)
     ═══════════════════════════════════════════════════════════ */
  titulo("📊 TABELA DE NOTAS — " + (boletim.aluno?.nome || perfil.nome || matricula));
  console.log(`  Turma: ${boletim.turma?.turma || "?"}`);

  if (boletim.situacao) {
    console.log("\n  Resumo da série:");
    const largS = [16, 12];
    console.log("  " + topo(largS));
    console.log("  " + linha(["Campo", "Valor"], largS));
    console.log("  " + separador(largS));
    Object.entries(boletim.situacao).forEach(([k, v]) => {
      console.log("  " + linha([k, v], largS));
    });
    console.log("  " + base(largS));
  }

  console.log();

  // Larguras das colunas
  const largN = [3, 38, 22, 7, 7, 7, 7, 8, 8];
  const cab = ["#", "Disciplina", "Professor", "1º Bim", "2º Bim", "3º Bim", "4º Bim", "Faltas", "Situação"];

  console.log(topo(largN));
  console.log(linha(cab, largN));
  console.log(separador(largN));

  let totalNotas = 0;
  let somaNotas = 0;

  boletim.disciplinas.forEach((d, i) => {
    const prof = (professores[d.nome]?.professor || d.professor || "—").slice(0, 20);

    // Conta médias
    [d.bim1, d.bim2, d.bim3, d.bim4].forEach((n) => {
      const num = parseFloat(String(n).replace(",", "."));
      if (!isNaN(num)) { totalNotas++; somaNotas += num; }
    });

    console.log(linha([
      String(i + 1),
      d.nome.slice(0, 36),
      prof,
      d.bim1 || "—",
      d.bim2 || "—",
      d.bim3 || "—",
      d.bim4 || "—",
      d.faltas || "0",
      d.situacao || "—",
    ], largN));
  });

  console.log(base(largN));

  /* ═══════════════════════════════════════════════════════════
     RESUMO GERAL
     ═══════════════════════════════════════════════════════════ */
  titulo("📈 RESUMO GERAL");

  const disciplinasComNota = boletim.disciplinas.filter((d) =>
    [d.bim1, d.bim2, d.bim3, d.bim4].some((n) => n && n.trim() !== "")
  ).length;

  const mediaGeral = totalNotas > 0 ? (somaNotas / totalNotas).toFixed(2) : "—";

  const largR = [30, 20];
  console.log(topo(largR));
  console.log(linha(["Métrica", "Valor"], largR));
  console.log(separador(largR));
  console.log(linha(["Total de disciplinas", boletim.disciplinas.length], largR));
  console.log(linha(["Disciplinas com nota", disciplinasComNota], largR));
  console.log(linha(["Total de notas lançadas", totalNotas], largR));
  console.log(linha(["Média geral (todas as notas)", mediaGeral], largR));
  console.log(linha(["Total de faltas", boletim.situacao?.faltas || "0"], largR));
  console.log(linha(["Frequência", boletim.situacao?.frequencia || "—"], largR));
  console.log(linha(["Situação final", boletim.situacao?.status || "—"], largR));
  console.log(base(largR));

  /* ═══════════════════════════════════════════════════════════
     TEMPOS
     ═══════════════════════════════════════════════════════════ */
  titulo("⏱️  TEMPOS DE EXECUÇÃO");
  console.log(`  Tempo total: ${Date.now() - t0}ms`);
  console.log(`  Login:       ${tempo()}`);

  console.log("\n" + "═".repeat(80));
  console.log("  ✅ DEBUG CONCLUÍDO COM SUCESSO");
  console.log("═".repeat(80) + "\n");
})().catch((e) => {
  console.error(`\n💥 ERRO FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
