import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

/* ============================================================
   ALGORITMO DE CÁLCULO DE RISCO
   Baseado em 4 variáveis (inspirado no INEP):
   - Faltas
   - Queda de notas
   - Atividades não entregues
   - Dias sem acessar o portal
   ============================================================ */

function calcularRisco({ faltas, notaAtual, notaAnterior, atividadesPendentes, diasSemAcesso }) {
  const fatores = {};
  const sugestoes = [];
  let score = 0;

  // 1. FALTAS (peso 30)
  const f = parseInt(faltas) || 0;
  if (f >= 30) {
    score += 30;
    fatores.faltas = { valor: f, peso: 30, nivel: "critico" };
    sugestoes.push("Agendar reunião urgente com os pais");
  } else if (f >= 20) {
    score += 22;
    fatores.faltas = { valor: f, peso: 22, nivel: "alto" };
    sugestoes.push("Entrar em contato com os responsáveis");
  } else if (f >= 10) {
    score += 12;
    fatores.faltas = { valor: f, peso: 12, nivel: "medio" };
  } else if (f >= 5) {
    score += 5;
    fatores.faltas = { valor: f, peso: 5, nivel: "baixo" };
  }

  // 2. QUEDA DE NOTAS (peso 25)
  if (notaAtual && notaAnterior) {
    const diff = notaAtual - notaAnterior;
    if (diff <= -3) {
      score += 25;
      fatores.notas = { diff, peso: 25, nivel: "critico", atual: notaAtual, anterior: notaAnterior };
      sugestoes.push("Oferecer recuperação paralela");
    } else if (diff <= -1.5) {
      score += 15;
      fatores.notas = { diff, peso: 15, nivel: "alto", atual: notaAtual, anterior: notaAnterior };
      sugestoes.push("Monitorar desempenho nas próximas avaliações");
    } else if (notaAtual < 6) {
      score += 10;
      fatores.notas = { diff, peso: 10, nivel: "medio", atual: notaAtual };
      sugestoes.push("Oferecer tutoria em grupo");
    }
  } else if (notaAtual && notaAtual < 5) {
    score += 12;
    fatores.notas = { atual: notaAtual, peso: 12, nivel: "medio" };
    sugestoes.push("Oferecer tutoria em grupo");
  }

  // 3. ATIVIDADES PENDENTES (peso 25)
  const ap = parseInt(atividadesPendentes) || 0;
  if (ap >= 8) {
    score += 25;
    fatores.atividades = { valor: ap, peso: 25, nivel: "critico" };
    sugestoes.push("Verificar se aluno está com dificuldades de acesso");
  } else if (ap >= 5) {
    score += 15;
    fatores.atividades = { valor: ap, peso: 15, nivel: "alto" };
    sugestoes.push("Conversar com o aluno sobre as pendências");
  } else if (ap >= 3) {
    score += 8;
    fatores.atividades = { valor: ap, peso: 8, nivel: "medio" };
  }

  // 4. DIAS SEM ACESSAR (peso 20)
  const d = parseInt(diasSemAcesso) || 0;
  if (d >= 21) {
    score += 20;
    fatores.acesso = { valor: d, peso: 20, nivel: "critico" };
    sugestoes.push("Verificar se aluno está com problema de saúde");
  } else if (d >= 14) {
    score += 14;
    fatores.acesso = { valor: d, peso: 14, nivel: "alto" };
    sugestoes.push("Enviar mensagem verificando bem-estar");
  } else if (d >= 7) {
    score += 7;
    fatores.acesso = { valor: d, peso: 7, nivel: "medio" };
  }

  score = Math.min(score, 100);

  let nivel = "baixo";
  if (score >= 75) nivel = "critico";
  else if (score >= 50) nivel = "alto";
  else if (score >= 25) nivel = "medio";

  return { score, nivel, fatores, sugestoes };
}

/* ============================================================
   ANALISAR TODOS OS ALUNOS
   ============================================================ */
router.post("/analisar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  try {
    const { data: alunos } = await adminClient.from("alunos").select("*");

    if (!alunos || alunos.length === 0) {
      return res.json({ ok: true, analisados: 0, resultados: [] });
    }

    const resultados = [];

    for (const aluno of alunos) {
      const matricula = aluno.matricula;
      const boletim = aluno.boletim || {};

      let faltasTotal = 0;
      let notaAtual = null;
      let notaAnterior = null;

      if (boletim.disciplinas?.length) {
        for (const d of boletim.disciplinas) {
          faltasTotal += parseInt(d.faltas || "0");

          const notas = [d.bim1, d.bim2, d.bim3, d.bim4]
            .map((n) => parseFloat(String(n || "").replace(",", ".")))
            .filter((n) => !isNaN(n));

          if (notas.length >= 2) {
            const ultima = notas[notas.length - 1];
            const penultima = notas[notas.length - 2];
            if (notaAtual === null || ultima < notaAtual) {
              notaAtual = ultima;
              notaAnterior = penultima;
            }
          } else if (notas.length === 1) {
            if (notaAtual === null || notas[0] < notaAtual) {
              notaAtual = notas[0];
            }
          }
        }
      }

      // Atividades pendentes
      const { count: totalAtividades } = await adminClient
        .from("atividades_turma")
        .select("*", { count: "exact", head: true })
        .eq("turma", aluno.turma || "")
        .eq("ativo", true);

      const { count: enviadas } = await adminClient
        .from("envios")
        .select("*", { count: "exact", head: true })
        .eq("aluno_matricula", matricula);

      const atividadesPendentes = Math.max(0, (totalAtividades || 0) - (enviadas || 0));

      // Dias sem acessar
      const ultimaAtualizacao = aluno.atualizado_em
        ? new Date(aluno.atualizado_em)
        : new Date(aluno.criado_em);
      const diasSemAcesso = Math.floor((Date.now() - ultimaAtualizacao.getTime()) / 86400000);

      const risco = calcularRisco({
        faltas: faltasTotal,
        notaAtual,
        notaAnterior,
        atividadesPendentes,
        diasSemAcesso,
      });

      resultados.push({
        aluno_matricula: matricula,
        aluno_nome: aluno.nome || `Aluno ${matricula}`,
        turma: aluno.turma || null,
        score: risco.score,
        nivel_risco: risco.nivel,
        fatores: risco.fatores,
        sugestoes: risco.sugestoes,
      });
    }

    if (resultados.length > 0) {
      await adminClient
        .from("risco_evasao")
        .upsert(
          resultados.map((r) => ({
            ...r,
            analisado_por: req.user.id,
            ultima_analise: new Date().toISOString(),
          })),
          { onConflict: "aluno_matricula" }
        );
    }

    res.json({
      ok: true,
      analisados: resultados.length,
      resultados: resultados.sort((a, b) => b.score - a.score),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   LISTAR ALUNOS EM RISCO
   ============================================================ */
router.get("/lista", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { nivel, turma } = req.query;

  let query = adminClient
    .from("risco_evasao")
    .select("*")
    .order("score", { ascending: false });

  if (nivel) query = query.eq("nivel_risco", nivel);
  if (turma) query = query.eq("turma", turma);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* ============================================================
   DETALHES DE UM ALUNO
   ============================================================ */
router.get("/aluno/:matricula", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("risco_evasao")
    .select("*")
    .eq("aluno_matricula", req.params.matricula)
    .maybeSingle();

  if (error) return res.status(500).json({ erro: error.message });
  if (!data) return res.status(404).json({ erro: "Análise não encontrada" });

  const { data: acoes } = await adminClient
    .from("acoes_risco")
    .select("*")
    .eq("aluno_matricula", req.params.matricula)
    .order("criado_em", { ascending: false });

  res.json({ ...data, acoes: acoes || [] });
});

/* ============================================================
   REGISTRAR AÇÃO TOMADA
   ============================================================ */
router.post("/acoes", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { aluno_matricula, tipo, descricao } = req.body;

  if (!aluno_matricula || !tipo) {
    return res.status(400).json({ erro: "Aluno e tipo obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("acoes_risco")
    .insert([{
      aluno_matricula,
      tipo,
      descricao: descricao || null,
      autor_id: req.user.id,
      autor_nome: req.user.nome,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   ATUALIZAR STATUS DA AÇÃO
   ============================================================ */
router.put("/acoes/:id/status", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { status } = req.body;

  const { error } = await adminClient
    .from("acoes_risco")
    .update({ status })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

/* ============================================================
   ESTATÍSTICAS GERAIS
   ============================================================ */
router.get("/estatisticas", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("risco_evasao")
    .select("nivel_risco");

  if (error) return res.status(500).json({ erro: error.message });

  const stats = {
    total: data?.length || 0,
    critico: data?.filter((d) => d.nivel_risco === "critico").length || 0,
    alto: data?.filter((d) => d.nivel_risco === "alto").length || 0,
    medio: data?.filter((d) => d.nivel_risco === "medio").length || 0,
    baixo: data?.filter((d) => d.nivel_risco === "baixo").length || 0,
  };

  res.json(stats);
});

export default router;
