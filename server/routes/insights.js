import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario, middlewareAdmin } from "../auth.js";

const router = express.Router();

/* ============================================================
   MÓDULO 1: ALERTAS INTELIGENTES
   ============================================================ */

// Listar alertas do aluno
router.get("/alertas/aluno/:matricula", async (req, res) => {
  const { data, error } = await adminClient
    .from("alertas")
    .select("*")
    .eq("aluno_matricula", req.params.matricula)
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Listar alertas do professor
router.get("/alertas/professor/:id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("alertas")
    .select("*")
    .eq("destinatario_tipo", "professor")
    .eq("destinatario_id", req.params.id)
    .order("criado_em", { ascending: false })
    .limit(30);

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Listar alertas do admin
router.get("/alertas/admin", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient
    .from("alertas")
    .select("*")
    .eq("destinatario_tipo", "admin")
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Marcar alerta como lido
router.put("/alertas/:id/lido", middlewareAuth, async (req, res) => {
  const { error } = await adminClient
    .from("alertas")
    .update({ lido: true })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

// GERAR alertas automaticamente (baseado no boletim)
router.post("/alertas/gerar", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { aluno_matricula, aluno_nome, turma, boletim } = req.body;

  if (!aluno_matricula || !boletim) {
    return res.status(400).json({ erro: "Aluno e boletim obrigatórios" });
  }

  const alertas = [];

  for (const d of boletim.disciplinas || []) {
    const notas = [d.bim1, d.bim2, d.bim3, d.bim4]
      .map((n) => parseFloat(String(n || "").replace(",", ".")))
      .filter((n) => !isNaN(n));

    if (notas.length === 0) continue;

    // Nota baixa
    const ultima = notas[notas.length - 1];
    if (ultima < 6) {
      alertas.push({
        aluno_matricula, aluno_nome, turma,
        tipo: "nota_baixa",
        titulo: `Nota baixa em ${d.nome}`,
        descricao: `Você tirou ${ultima} no último bimestre. Procure o professor para recuperação.`,
        severidade: ultima < 4 ? "critica" : "alta",
        destinatario_tipo: "aluno",
        destinatario_id: aluno_matricula,
      });
    }

    // Queda de nota (comparar últimos 2 bimestres)
    if (notas.length >= 2) {
      const penultima = notas[notas.length - 2];
      const diff = ultima - penultima;
      if (diff <= -1.5) {
        alertas.push({
          aluno_matricula, aluno_nome, turma,
          tipo: "queda_nota",
          titulo: `Queda em ${d.nome}`,
          descricao: `Sua nota caiu de ${penultima} para ${ultima}. Atenção!`,
          severidade: diff <= -3 ? "critica" : "alta",
          destinatario_tipo: "aluno",
          destinatario_id: aluno_matricula,
        });
      }
    }

    // Faltas altas
    const faltas = parseInt(d.faltas || "0");
    if (faltas >= 10) {
      alertas.push({
        aluno_matricula, aluno_nome, turma,
        tipo: "frequencia_baixa",
        titulo: `Muitas faltas em ${d.nome}`,
        descricao: `Você tem ${faltas} faltas nesta disciplina.`,
        severidade: faltas >= 15 ? "critica" : "alta",
        destinatario_tipo: "aluno",
        destinatario_id: aluno_matricula,
      });
    }
  }

  if (alertas.length === 0) {
    return res.json({ ok: true, gerados: 0 });
  }

  const { error } = await adminClient.from("alertas").insert(alertas);
  if (error) return res.status(500).json({ erro: error.message });

  res.json({ ok: true, gerados: alertas.length });
});

/* ============================================================
   MÓDULO 2: DETECÇÃO DE PLÁGIO
   ============================================================ */

// Algoritmo de Jaccard
function similaridadeJaccard(textoA, textoB) {
  if (!textoA || !textoB) return 0;

  const normalizar = (t) =>
    t.toLowerCase()
      .replace(/[^\wáàâãéèêíïóôõöúçñ\s]/gi, "")
      .split(/\s+/)
      .filter((p) => p.length > 3);

  const palavrasA = new Set(normalizar(textoA));
  const palavrasB = new Set(normalizar(textoB));

  if (palavrasA.size === 0 || palavrasB.size === 0) return 0;

  const intersecao = [...palavrasA].filter((p) => palavrasB.has(p));
  const uniao = new Set([...palavrasA, ...palavrasB]);

  return (intersecao.length / uniao.size) * 100;
}

// Analisar uma atividade
router.post("/plagio/analisar/:atividade_id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { atividade_id } = req.params;

  const { data: envios } = await adminClient
    .from("envios")
    .select("*")
    .eq("atividade_id", atividade_id);

  if (!envios || envios.length < 2) {
    return res.json({ ok: true, analises: [] });
  }

  const analises = [];

  for (let i = 0; i < envios.length; i++) {
    for (let j = i + 1; j < envios.length; j++) {
      const a = envios[i];
      const b = envios[j];

      const textoA = a.descricao || a.titulo || "";
      const textoB = b.descricao || b.titulo || "";

      const sim = similaridadeJaccard(textoA, textoB);

      if (sim >= 50) {
        analises.push({
          envio_id_1: a.id,
          envio_id_2: b.id,
          aluno_1: a.aluno_nome,
          aluno_2: b.aluno_nome,
          turma: a.turma,
          atividade_id,
          similaridade: Math.round(sim * 100) / 100,
          texto_1: textoA,
          texto_2: textoB,
        });
      }
    }
  }

  if (analises.length > 0) {
    await adminClient.from("analises_plagio").delete().eq("atividade_id", atividade_id);
    await adminClient.from("analises_plagio").insert(analises);
  }

  res.json({ ok: true, analises });
});

// Listar análises
router.get("/plagio/:atividade_id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("analises_plagio")
    .select("*")
    .eq("atividade_id", req.params.atividade_id)
    .order("similaridade", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   MÓDULO 3: GAMIFICAÇÃO
   ============================================================ */

// Ranking geral (todos os alunos)
router.get("/gamificacao/ranking", async (req, res) => {
  const { turma, limite = 100 } = req.query;

  let query = adminClient
    .from("pontos_aluno")
    .select("*")
    .order("pontos", { ascending: false })
    .limit(parseInt(limite));

  if (turma) query = query.eq("turma", turma);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });

  const comPosicao = (data || []).map((d, i) => ({ ...d, posicao: i + 1 }));
  res.json(comPosicao);
});

// Ranking por turma
router.get("/gamificacao/turmas", async (req, res) => {
  const { data, error } = await adminClient
    .from("ranking_turmas")
    .select("*")
    .order("pontos_total", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Detalhes de um aluno
router.get("/gamificacao/aluno/:matricula", async (req, res) => {
  const { matricula } = req.params;

  const { data: pontos } = await adminClient
    .from("pontos_aluno")
    .select("*")
    .eq("aluno_matricula", matricula)
    .maybeSingle();

  const { data: conquistas } = await adminClient
    .from("conquistas_aluno")
    .select("*")
    .eq("aluno_matricula", matricula)
    .order("conquistado_em", { ascending: false });

  const { data: ranking } = await adminClient
    .from("pontos_aluno")
    .select("aluno_matricula, pontos")
    .order("pontos", { ascending: false });

  const posicao = (ranking || []).findIndex((r) => r.aluno_matricula === matricula) + 1;

  res.json({
    pontos: pontos || { pontos: 0, nivel: 1, streak: 0 },
    conquistas: conquistas || [],
    posicaoGeral: posicao || null,
    totalAlunos: ranking?.length || 0,
  });
});

// Detalhes de uma turma
router.get("/gamificacao/turma/:turma", async (req, res) => {
  const { turma } = req.params;

  const { data: alunos } = await adminClient
    .from("pontos_aluno")
    .select("*")
    .eq("turma", turma)
    .order("pontos", { ascending: false });

  const { data: turma_info } = await adminClient
    .from("ranking_turmas")
    .select("*")
    .eq("turma", turma)
    .maybeSingle();

  const { data: ranking_geral } = await adminClient
    .from("ranking_turmas")
    .select("turma, pontos_total")
    .order("pontos_total", { ascending: false });

  const posicao = (ranking_geral || []).findIndex((r) => r.turma === turma) + 1;

  res.json({
    turma,
    info: turma_info || { pontos_total: 0, media_alunos: 0, total_alunos: 0 },
    posicaoGeral: posicao || null,
    totalTurmas: ranking_geral?.length || 0,
    alunos: alunos || [],
  });
});

// Adicionar pontos a um aluno
router.post("/gamificacao/pontos", middlewareAuth, async (req, res) => {
  const { aluno_matricula, aluno_nome, turma, pontos, motivo } = req.body;

  if (!aluno_matricula || !pontos) {
    return res.status(400).json({ erro: "Aluno e pontos obrigatórios" });
  }

  const { data: existente } = await adminClient
    .from("pontos_aluno")
    .select("*")
    .eq("aluno_matricula", aluno_matricula)
    .maybeSingle();

  let novosPontos;
  if (existente) {
    novosPontos = (existente.pontos || 0) + pontos;
  } else {
    novosPontos = pontos;
  }

  // Calcula nível (a cada 100 pontos sobe)
  const nivel = Math.floor(novosPontos / 100) + 1;

  const { data, error } = await adminClient
    .from("pontos_aluno")
    .upsert([{
      aluno_matricula,
      aluno_nome,
      turma,
      pontos: novosPontos,
      nivel,
      ultima_atividade: new Date().toISOString(),
    }], { onConflict: "aluno_matricula" })
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });

  // Verifica conquistas
  await verificarConquistas(aluno_matricula, aluno_nome, turma, novosPontos);

  // Atualiza ranking da turma
  await atualizarRankingTurma(turma);

  res.json(data);
});

async function verificarConquistas(matricula, nome, turma, pontos) {
  const badges = [];

  if (pontos >= 100) badges.push({ badge: "primeiro_100", icone: "🌟", descricao: "Primeiros 100 pontos" });
  if (pontos >= 500) badges.push({ badge: "mestre", icone: "🏆", descricao: "Mestre com 500 pontos" });
  if (pontos >= 1000) badges.push({ badge: "lenda", icone: "👑", descricao: "Lenda da escola" });

  for (const b of badges) {
    await adminClient
      .from("conquistas_aluno")
      .upsert([{
        aluno_matricula: matricula,
        aluno_nome: nome,
        turma,
        badge: b.badge,
        icone: b.icone,
        descricao: b.descricao,
        pontos: 50,
      }], { onConflict: "aluno_matricula,badge" });
  }
}

async function atualizarRankingTurma(turma) {
  if (!turma) return;

  const { data: alunos } = await adminClient
    .from("pontos_aluno")
    .select("pontos")
    .eq("turma", turma);

  if (!alunos || alunos.length === 0) return;

  const total = alunos.reduce((s, a) => s + (a.pontos || 0), 0);
  const media = total / alunos.length;

  await adminClient
    .from("ranking_turmas")
    .upsert([{
      turma,
      pontos_total: total,
      media_alunos: Math.round(media * 100) / 100,
      total_alunos: alunos.length,
      atualizado_em: new Date().toISOString(),
    }], { onConflict: "turma" });
}

/* ============================================================
   MÓDULO 4: ESTUDO COLABORATIVO
   ============================================================ */

// Listar grupos
router.get("/grupos", async (req, res) => {
  const { turma } = req.query;

  let query = adminClient
    .from("grupos_estudo")
    .select("*")
    .eq("ativo", true)
    .order("criado_em", { ascending: false });

  if (turma) query = query.eq("turma", turma);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });

  // Adiciona contagem de participantes
  const grupos = await Promise.all(
    (data || []).map(async (g) => {
      const { count } = await adminClient
        .from("participantes_grupo")
        .select("*", { count: "exact", head: true })
        .eq("grupo_id", g.id);
      return { ...g, total_participantes: count || 0 };
    })
  );

  res.json(grupos);
});

// Criar grupo
router.post("/grupos", middlewareAuth, async (req, res) => {
  const {
    titulo, descricao, atividade_id, criador_matricula, criador_nome,
    turma, materia, data_encontro, local, link_video, max_participantes,
  } = req.body;

  if (!titulo || !criador_matricula) {
    return res.status(400).json({ erro: "Título e criador obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("grupos_estudo")
    .insert([{
      titulo,
      descricao: descricao || null,
      atividade_id: atividade_id || null,
      criador_matricula,
      criador_nome,
      turma,
      materia: materia || null,
      data_encontro: data_encontro || null,
      local: local || null,
      link_video: link_video || null,
      max_participantes: max_participantes || 10,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });

  // Adiciona criador como participante
  await adminClient.from("participantes_grupo").insert([{
    grupo_id: data.id,
    aluno_matricula: criador_matricula,
    aluno_nome: criador_nome,
  }]);

  res.json(data);
});

// Entrar num grupo
router.post("/grupos/:id/entrar", middlewareAuth, async (req, res) => {
  const { aluno_matricula, aluno_nome } = req.body;

  if (!aluno_matricula) return res.status(400).json({ erro: "Aluno obrigatório" });

  const { data: grupo } = await adminClient
    .from("grupos_estudo")
    .select("max_participantes")
    .eq("id", req.params.id)
    .single();

  const { count } = await adminClient
    .from("participantes_grupo")
    .select("*", { count: "exact", head: true })
    .eq("grupo_id", req.params.id);

  if (count >= grupo.max_participantes) {
    return res.status(400).json({ erro: "Grupo cheio" });
  }

  const { error } = await adminClient.from("participantes_grupo").insert([{
    grupo_id: req.params.id,
    aluno_matricula,
    aluno_nome,
  }]);

  if (error) {
    if (error.code === "23505") return res.status(400).json({ erro: "Você já está neste grupo" });
    return res.status(500).json({ erro: error.message });
  }

  res.json({ ok: true });
});

// Sair do grupo
router.post("/grupos/:id/sair", middlewareAuth, async (req, res) => {
  const { aluno_matricula } = req.body;

  await adminClient
    .from("participantes_grupo")
    .delete()
    .eq("grupo_id", req.params.id)
    .eq("aluno_matricula", aluno_matricula);

  res.json({ ok: true });
});

// Listar participantes
router.get("/grupos/:id/participantes", async (req, res) => {
  const { data, error } = await adminClient
    .from("participantes_grupo")
    .select("*")
    .eq("grupo_id", req.params.id)
    .order("entrou_em");

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Mensagens do grupo
router.get("/grupos/:id/mensagens", middlewareAuth, async (req, res) => {
  const { data, error } = await adminClient
    .from("mensagens_grupo")
    .select("*")
    .eq("grupo_id", req.params.id)
    .order("criado_em", { ascending: true })
    .limit(100);

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.post("/grupos/:id/mensagens", middlewareAuth, async (req, res) => {
  const { autor_matricula, autor_nome, texto } = req.body;

  if (!texto?.trim()) return res.status(400).json({ erro: "Texto obrigatório" });

  const { data, error } = await adminClient
    .from("mensagens_grupo")
    .insert([{
      grupo_id: req.params.id,
      autor_matricula,
      autor_nome,
      texto: texto.trim(),
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Excluir grupo (só quem criou)
router.delete("/grupos/:id", middlewareAuth, async (req, res) => {
  const { error } = await adminClient
    .from("grupos_estudo")
    .update({ ativo: false })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
