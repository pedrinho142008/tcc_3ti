import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario, middlewareAdmin } from "../auth.js";

const router = express.Router();

/* ============================================================
   MÓDULO 5: MURAL DE HONRA
   ============================================================ */

// Listar top 3 do mês atual
router.get("/mural/atual", async (req, res) => {
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  const { data, error } = await adminClient
    .from("mural_honra")
    .select("*")
    .eq("mes", mes)
    .eq("ano", ano)
    .order("posicao", { ascending: true })
    .limit(3);

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Listar todo o mural (histórico)
router.get("/mural", async (req, res) => {
  const { ano, mes } = req.query;

  let query = adminClient
    .from("mural_honra")
    .select("*")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .order("posicao", { ascending: true });

  if (ano) query = query.eq("ano", parseInt(ano));
  if (mes) query = query.eq("mes", parseInt(mes));

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Gerar mural do mês (admin)
router.post("/mural/gerar", middlewareAuth, middlewareAdmin, async (req, res) => {
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  // Pega top 3 alunos
  const { data: top3 } = await adminClient
    .from("pontos_aluno")
    .select("*")
    .order("pontos", { ascending: false })
    .limit(3);

  if (!top3 || top3.length === 0) {
    return res.status(400).json({ erro: "Nenhum aluno com pontos ainda" });
  }

  // Remove mural do mês atual se já existe
  await adminClient
    .from("mural_honra")
    .delete()
    .eq("mes", mes)
    .eq("ano", ano);

  // Insere os top 3
  const registros = top3.map((a, i) => ({
    aluno_matricula: a.aluno_matricula,
    aluno_nome: a.aluno_nome,
    turma: a.turma,
    pontos: a.pontos,
    posicao: i + 1,
    mes,
    ano,
    destaque: i === 0,
    premio: i === 0 ? "🥇 1º Lugar" : i === 1 ? "🥈 2º Lugar" : "🥉 3º Lugar",
  }));

  const { error } = await adminClient.from("mural_honra").insert(registros);
  if (error) return res.status(500).json({ erro: error.message });

  res.json({ ok: true, registros });
});

/* ============================================================
   MÓDULO 6: CERTIFICADOS
   ============================================================ */

// Listar certificados do aluno
router.get("/certificados/aluno/:matricula", async (req, res) => {
  const { data, error } = await adminClient
    .from("certificados")
    .select("*")
    .eq("aluno_matricula", req.params.matricula)
    .order("emitido_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Listar certificados emitidos pelo admin
router.get("/certificados", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient
    .from("certificados")
    .select("*")
    .order("emitido_em", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Verificar autenticidade do certificado
router.get("/certificados/verificar/:codigo", async (req, res) => {
  const { data, error } = await adminClient
    .from("certificados")
    .select("*")
    .eq("codigo_verificacao", req.params.codigo)
    .maybeSingle();

  if (error) return res.status(500).json({ erro: error.message });
  if (!data) return res.status(404).json({ erro: "Certificado não encontrado" });

  res.json({
    valido: true,
    aluno: data.aluno_nome,
    titulo: data.titulo,
    emissor: data.emissor_nome,
    data: data.emitido_em,
  });
});

// Emitir certificado (admin)
router.post("/certificados/emitir", middlewareAuth, middlewareAdmin, async (req, res) => {
  const {
    destinatarios, // array de { matricula, nome, turma }
    tipo,
    titulo,
    descricao,
    premio_base,
  } = req.body;

  if (!destinatarios || !Array.isArray(destinatarios) || destinatarios.length === 0) {
    return res.status(400).json({ erro: "Escolha pelo menos um destinatário" });
  }
  if (!titulo) return res.status(400).json({ erro: "Título obrigatório" });

  const registros = destinatarios.map((d) => {
    const codigo = gerarCodigoVerificacao();
    return {
      aluno_matricula: d.matricula,
      aluno_nome: d.nome,
      turma: d.turma,
      tipo: tipo || "conquista",
      titulo: premio_base ? `${premio_base} - ${titulo}` : titulo,
      descricao: descricao || null,
      emissor_id: req.user.id,
      emissor_nome: req.user.nome,
      emissor_cargo: req.user.cargo,
      codigo_verificacao: codigo,
    };
  });

  const { data, error } = await adminClient.from("certificados").insert(registros).select();
  if (error) return res.status(500).json({ erro: error.message });

  res.json({ ok: true, emitidos: data.length, certificados: data });
});

// Marcar como visualizado
router.put("/certificados/:id/visualizar", async (req, res) => {
  const { error } = await adminClient
    .from("certificados")
    .update({ visualizado: true })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

// Excluir certificado (admin)
router.delete("/certificados/:id", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { error } = await adminClient
    .from("certificados")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

function gerarCodigoVerificacao() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < 8; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}

/* ============================================================
   MÓDULO 7: PEER TEACHING (ajuda entre alunos)
   ============================================================ */

// Listar monitores
router.get("/monitores", async (req, res) => {
  const { materia, turma } = req.query;

  let query = adminClient
    .from("monitores")
    .select("*")
    .eq("ativo", true)
    .order("criado_em", { ascending: false });

  if (materia) query = query.eq("materia", materia);
  if (turma) query = query.eq("turma", turma);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Matérias disponíveis (únicas)
router.get("/monitores/materias", async (req, res) => {
  const { data, error } = await adminClient
    .from("monitores")
    .select("materia")
    .eq("ativo", true);

  if (error) return res.status(500).json({ erro: error.message });
  const materias = [...new Set((data || []).map((m) => m.materia))];
  res.json(materias);
});

// Cadastrar-se como monitor
router.post("/monitores", middlewareAuth, async (req, res) => {
  const {
    aluno_matricula, aluno_nome, turma,
    materia, descricao, disponibilidade, contato_preferido,
  } = req.body;

  if (!aluno_matricula || !materia) {
    return res.status(400).json({ erro: "Aluno e matéria obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("monitores")
    .upsert([{
      aluno_matricula, aluno_nome, turma,
      materia, descricao: descricao || null,
      disponibilidade: disponibilidade || null,
      contato_preferido: contato_preferido || null,
    }], { onConflict: "aluno_matricula,materia" })
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Remover-se como monitor
router.delete("/monitores/:id", middlewareAuth, async (req, res) => {
  const { error } = await adminClient
    .from("monitores")
    .update({ ativo: false })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

// Pedir ajuda a um monitor
router.post("/pedidos", middlewareAuth, async (req, res) => {
  const { monitor_id, solicitante_matricula, solicitante_nome, materia, mensagem } = req.body;

  if (!monitor_id || !solicitante_matricula) {
    return res.status(400).json({ erro: "Monitor e solicitante obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("pedidos_ajuda")
    .insert([{
      monitor_id,
      solicitante_matricula,
      solicitante_nome,
      materia,
      mensagem: mensagem || null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

// Listar pedidos do monitor
router.get("/pedidos/monitor/:matricula", middlewareAuth, async (req, res) => {
  const { data: monitores } = await adminClient
    .from("monitores")
    .select("id")
    .eq("aluno_matricula", req.params.matricula);

  if (!monitores || monitores.length === 0) return res.json([]);

  const ids = monitores.map((m) => m.id);

  const { data, error } = await adminClient
    .from("pedidos_ajuda")
    .select("*")
    .in("monitor_id", ids)
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Listar pedidos feitos pelo solicitante
router.get("/pedidos/solicitante/:matricula", middlewareAuth, async (req, res) => {
  const { data, error } = await adminClient
    .from("pedidos_ajuda")
    .select("*")
    .eq("solicitante_matricula", req.params.matricula)
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Atualizar status do pedido
router.put("/pedidos/:id/status", middlewareAuth, async (req, res) => {
  const { status } = req.body;

  const { error } = await adminClient
    .from("pedidos_ajuda")
    .update({ status })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
