import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

/* ============================================================
   VISUALIZAR
   ============================================================ */
router.put("/envios/:id/visualizar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("envios")
    .update({ status: "visualizado", atualizado_em: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   CORRIGIR (nota + observação direta)
   ============================================================ */
router.put("/envios/:id/corrigir", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { nota, comentario_professor } = req.body;

  if (nota === undefined || nota === null) {
    return res.status(400).json({ erro: "Nota obrigatória" });
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
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   ACEITAR (após prazo — com nota + obs)
   ============================================================ */
router.put("/envios/:id/aceitar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { nota, comentario_professor } = req.body;

  if (nota === undefined || nota === null) {
    return res.status(400).json({ erro: "Nota é obrigatória ao aceitar" });
  }

  const notaNum = parseFloat(nota);
  if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
    return res.status(400).json({ erro: "Nota deve estar entre 0 e 10" });
  }

  const { data, error } = await adminClient
    .from("envios")
    .update({
      aceita: true,
      recusada_motivo: null,
      nota: notaNum,
      comentario_professor: comentario_professor || null,
      status: "corrigido",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   RECUSAR (sai do painel e vai pro histórico)
   ============================================================ */
router.put("/envios/:id/recusar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { motivo } = req.body;

  const { data, error } = await adminClient
    .from("envios")
    .update({
      aceita: false,
      recusada_motivo: motivo || "Não aceita pelo professor",
      status: "recusado",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   HISTÓRICO DE RECUSADAS
   ============================================================ */
router.get("/envios/recusadas", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("envios")
    .select("*")
    .eq("status", "recusado")
    .order("atualizado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* ============================================================
   HISTÓRICO DE ENTREGAS DE UM ALUNO
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
   DASHBOARD DE UMA TURMA
   ============================================================ */
router.get("/turmas/:turma/dashboard", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const turma = decodeURIComponent(req.params.turma);

  try {
    const { data: alunos } = await adminClient
      .from("alunos").select("matricula, nome").eq("turma", turma);
    const alunosArr = alunos || [];

    const { data: atividades } = await adminClient
      .from("atividades_turma").select("id, titulo, prazo").eq("turma", turma).eq("ativo", true);
    const atividadesArr = atividades || [];
    const atividadeIds = atividadesArr.map((a) => a.id);

    let envios = [];
    if (atividadeIds.length > 0) {
      const { data: e } = await adminClient
        .from("envios")
        .select("id, aluno_matricula, aluno_nome, atividade_id, titulo, status, nota, criado_em, arquivo_url, arquivo_tipo, arquivo_nome, descricao, aceita, recusada_motivo")
        .in("atividade_id", atividadeIds)
        .order("criado_em", { ascending: false });
      envios = e || [];
    }

    const entregasPendentes = envios.filter((e) => e.status === "enviado").length;
    const entregasCorrigidas = envios.filter((e) => e.status === "corrigido").length;
    const entregasRecusadas = envios.filter((e) => e.status === "recusado").length;
    const alunosComEntrega = new Set(envios.map((e) => e.aluno_matricula));
    const alunosSemEntrega = alunosArr.filter((a) => !alunosComEntrega.has(a.matricula));

    const notasValidas = envios.filter((e) => e.nota !== null && e.nota !== undefined);
    const mediaTurma = notasValidas.length > 0
      ? notasValidas.reduce((s, e) => s + parseFloat(e.nota), 0) / notasValidas.length
      : null;

    const ranking = {};
    for (const e of envios) {
      if (!ranking[e.aluno_matricula]) {
        ranking[e.aluno_matricula] = {
          matricula: e.aluno_matricula, nome: e.aluno_nome,
          entregas: 0, somaNotas: 0, notasCount: 0,
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

    const agora = new Date();
    const porDia = [];
    for (let i = 13; i >= 0; i--) {
      const dia = new Date(agora);
      dia.setDate(dia.getDate() - i);
      const diaStr = dia.toISOString().slice(0, 10);
      const count = envios.filter((e) => e.criado_em?.slice(0, 10) === diaStr).length;
      porDia.push({ dia: dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), count });
    }

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
      entregasCorrigidas,
      entregasRecusadas,
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

/* ============================================================
   DASHBOARD INDIVIDUAL DO ALUNO
   ============================================================ */
router.get("/alunos/:matricula/dashboard", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const matricula = req.params.matricula;

  try {
    const { data: aluno } = await adminClient
      .from("alunos").select("*").eq("matricula", matricula).maybeSingle();

    if (!aluno) return res.status(404).json({ erro: "Aluno não encontrado" });

    const { data: envios } = await adminClient
      .from("envios").select("*").eq("aluno_matricula", matricula)
      .order("criado_em", { ascending: false });
    const enviosArr = envios || [];

    const { data: atividadesTurma } = await adminClient
      .from("atividades_turma").select("id, titulo, prazo")
      .eq("turma", aluno.turma || "").eq("ativo", true);
    const atividadesArr = atividadesTurma || [];
    const entreguesIds = new Set(enviosArr.map((e) => e.atividade_id));
    const naoEntregues = atividadesArr.filter((a) => !entreguesIds.has(a.id));

    const notasValidas = enviosArr.filter((e) => e.nota !== null && e.nota !== undefined);
    const media = notasValidas.length > 0
      ? (notasValidas.reduce((s, e) => s + parseFloat(e.nota), 0) / notasValidas.length).toFixed(1)
      : null;

    const boletim = aluno.boletim || {};
    const disciplinas = boletim.disciplinas || [];

    const { data: anotacoes } = await adminClient
      .from("anotacoes_aluno").select("*").eq("aluno_matricula", matricula)
      .order("criado_em", { ascending: false }).limit(20);

    res.json({
      aluno,
      envios: enviosArr,
      naoEntregues,
      totalAtividades: atividadesArr.length,
      totalEntregues: enviosArr.length,
      media,
      disciplinas,
      anotacoes: anotacoes || [],
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

export default router;
