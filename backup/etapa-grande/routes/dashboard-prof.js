import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

const TURMAS = [
  "1º Ano A", "1º Ano T.I",
  "2º Ano A", "2º Ano T.I",
  "3º Ano A", "3º Ano T.I",
];

/* ============================================================
   Estatísticas gerais do professor
   ============================================================ */
router.get("/professor/dashboard", middlewareAuth, middlewareFuncionario, async (req, res) => {
  try {
    const professorId = req.user.id;

    // 1. Atividades do professor
    const { data: atividades } = await adminClient
      .from("atividades_turma")
      .select("*")
      .eq("professor_id", professorId)
      .eq("ativo", true);

    const totalAtividades = atividades?.length || 0;
    const atividadeIds = (atividades || []).map((a) => a.id);

    // 2. Entregas dessas atividades
    let envios = [];
    if (atividadeIds.length > 0) {
      const { data: e } = await adminClient
        .from("envios")
        .select("*")
        .in("atividade_id", atividadeIds);
      envios = e || [];
    }

    // 3. Alunos de todas as turmas
    const { data: alunos } = await adminClient
      .from("alunos")
      .select("matricula, nome, turma");

    const todosAlunos = alunos || [];
    const totalAlunos = todosAlunos.length;

    // 4. Cálculos
    const entregasPendentes = envios.filter((e) => e.status === "enviado").length;
    const entregasCorrigidas = envios.filter((e) => e.status === "corrigido").length;

    // Alunos sem entregar
    const alunosComEntrega = new Set(envios.map((e) => e.aluno_matricula));
    const alunosSemEntregar = totalAlunos - alunosComEntrega.size;

    // 5. Próximos prazos (atividades que vencem em 7 dias)
    const agora = new Date();
    const seteDias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

    const proximosPrazos = (atividades || [])
      .filter((a) => a.prazo && new Date(a.prazo) >= agora && new Date(a.prazo) <= seteDias)
      .sort((a, b) => new Date(a.prazo) - new Date(b.prazo));

    // 6. Atividades por turma
    const atividadesPorTurma = {};
    for (const t of TURMAS) atividadesPorTurma[t] = 0;
    for (const a of atividades || []) {
      if (atividadesPorTurma[a.turma] !== undefined) atividadesPorTurma[a.turma]++;
    }

    // 7. Entregas por turma
    const entregasPorTurma = {};
    for (const t of TURMAS) entregasPorTurma[t] = 0;
    for (const e of envios) {
      if (entregasPorTurma[e.turma] !== undefined) entregasPorTurma[e.turma]++;
    }

    // 8. Top 5 alunos por entregas
    const ranking = {};
    for (const e of envios) {
      if (!ranking[e.aluno_matricula]) {
        ranking[e.aluno_matricula] = {
          matricula: e.aluno_matricula,
          nome: e.aluno_nome,
          turma: e.turma,
          entregas: 0,
        };
      }
      ranking[e.aluno_matricula].entregas++;
    }

    const topAlunos = Object.values(ranking)
      .sort((a, b) => b.entregas - a.entregas)
      .slice(0, 5);

    // 9. Entregas nos últimos 7 dias
    const entregasPorDia = [];
    for (let i = 6; i >= 0; i--) {
      const dia = new Date(agora);
      dia.setDate(dia.getDate() - i);
      const diaStr = dia.toISOString().slice(0, 10);
      const count = envios.filter((e) => e.criado_em?.slice(0, 10) === diaStr).length;
      entregasPorDia.push({
        dia: dia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
        count,
      });
    }

    res.json({
      totalAtividades,
      totalAlunos,
      entregasPendentes,
      entregasCorrigidas,
      alunosSemEntregar,
      proximosPrazos,
      atividadesPorTurma,
      entregasPorTurma,
      topAlunos,
      entregasPorDia,
      totalEnvios: envios.length,
    });
  } catch (e) {
    console.error("Erro dashboard:", e);
    res.status(500).json({ erro: e.message });
  }
});

export default router;
