import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

/* ============================================================
   1. MARCAR COMO VISUALIZADO (só abre, sem nota)
   ============================================================ */
router.put("/envios/:id/visualizar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("envios")
    .update({
      status: "visualizado",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   2. CORRIGIR ENTREGA (nota + observação)
   ============================================================ */
router.put("/envios/:id/corrigir", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { nota, comentario_professor } = req.body;

  if (nota === undefined || nota === null) {
    return res.status(400).json({ erro: "Nota é obrigatória" });
  }

  const notaNum = parseFloat(nota);
  if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
    return res.status(400).json({ erro: "Nota deve estar entre 0 e 10" });
  }

  const { data, error } = await adminClient
    .from("envios")
    .update({
      nota: notaNum,
      comentario_professor: comentario_professor || null,
      status: "corrigido",
      corrigido_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   3. HISTÓRICO DE ENTREGAS DO ALUNO
   ============================================================ */
router.get("/alunos/:matricula/entregas", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("envios")
    .select("*")
    .eq("aluno_matricula", req.params.matricula)
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* ============================================================
   4. DASHBOARD DE UMA TURMA (ao vivo)
   ============================================================ */
router.get("/turmas/:turma/dashboard", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const turma = decodeURIComponent(req.params.turma);

  try {
    // Alunos da turma
    const { data: alunos } = await adminClient
      .from("alunos")
      .select("matricula, nome")
      .eq("turma", turma);

    const alunosArr = alunos || [];

    // Atividades da turma
    const { data: atividades } = await adminClient
      .from("atividades_turma")
      .select("id, titulo, prazo")
      .eq("turma", turma)
      .eq("ativo", true);

    const atividadesArr = atividades || [];
    const atividadeIds = atividadesArr.map((a) => a.id);

    // Envios da turma
    let envios = [];
    if (atividadeIds.length > 0) {
      const { data: e } = await adminClient
        .from("envios")
        .select("id, aluno_matricula, aluno_nome, atividade_id, titulo, status, nota, criado_em, arquivo_url, arquivo_tipo, arquivo_nome, descricao")
        .in("atividade_id", atividadeIds)
        .order("criado_em", { ascending: false });
      envios = e || [];
    }

    // Cálculos
    const entregasPendentes = envios.filter((e) => e.status === "enviado").length;
    const entregasVisualizadas = envios.filter((e) => e.status === "visualizado").length;
    const entregasCorrigidas = envios.filter((e) => e.status === "corrigido").length;
    const alunosComEntrega = new Set(envios.map((e) => e.aluno_matricula));
    const alunosSemEntrega = alunosArr.filter((a) => !alunosComEntrega.has(a.matricula));

    // Média das notas
    const notasValidas = envios.filter((e) => e.nota !== null && e.nota !== undefined);
    const mediaTurma = notasValidas.length > 0
      ? notasValidas.reduce((s, e) => s + parseFloat(e.nota), 0) / notasValidas.length
      : null;

    // Top alunos por entregas
    const ranking = {};
    for (const e of envios) {
      if (!ranking[e.aluno_matricula]) {
        ranking[e.aluno_matricula] = {
          matricula: e.aluno_matricula,
          nome: e.aluno_nome,
          entregas: 0,
          somaNotas: 0,
          notasCount: 0,
        };
      }
      ranking[e.aluno_matricula].entregas++;
      if (e.nota !== null && e.nota !== undefined) {
        ranking[e.aluno_matricula].somaNotas += parseFloat(e.nota);
        ranking[e.aluno_matricula].notasCount++;
      }
    }

    const rankingArr = Object.values(ranking).map((r) => ({
      ...r,
      media: r.notasCount > 0 ? (r.somaNotas / r.notasCount).toFixed(1) : null,
    })).sort((a, b) => b.entregas - a.entregas);

    // Entregas por dia (últimos 14 dias)
    const agora = new Date();
    const porDia = [];
    for (let i = 13; i >= 0; i--) {
      const dia = new Date(agora);
      dia.setDate(dia.getDate() - i);
      const diaStr = dia.toISOString().slice(0, 10);
      const count = envios.filter((e) => e.criado_em?.slice(0, 10) === diaStr).length;
      porDia.push({
        dia: dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        count,
      });
    }

    // Lista de alunos que enviaram (histórico)
    const alunosHistorico = alunosArr.map((a) => {
      const seusEnvios = envios.filter((e) => e.aluno_matricula === a.matricula);
      const ultimaEntrega = seusEnvios[0]?.criado_em || null;
      const notasAluno = seusEnvios.filter((e) => e.nota !== null && e.nota !== undefined);
      const mediaAluno = notasAluno.length > 0
        ? (notasAluno.reduce((s, e) => s + parseFloat(e.nota), 0) / notasAluno.length).toFixed(1)
        : null;

      return {
        ...a,
        totalEntregas: seusEnvios.length,
        ultimaEntrega,
        media: mediaAluno,
        enviouTodas: seusEnvios.length === atividadesArr.length && atividadesArr.length > 0,
      };
    }).sort((a, b) => b.totalEntregas - a.totalEntregas);

    res.json({
      turma,
      totalAlunos: alunosArr.length,
      totalAtividades: atividadesArr.length,
      totalEnvios: envios.length,
      entregasPendentes,
      entregasVisualizadas,
      entregasCorrigidas,
      mediaTurma: mediaTurma !== null ? mediaTurma.toFixed(1) : null,
      alunosSemEntrega: alunosSemEntrega.map((a) => a.nome),
      ranking: rankingArr.slice(0, 10),
      porDia,
      alunosHistorico,
      enviosRecentes: envios.slice(0, 20),
    });
  } catch (e) {
    console.error("Erro dashboard turma:", e);
    res.status(500).json({ erro: e.message });
  }
});

export default router;
