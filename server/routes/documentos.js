import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth } from "../auth.js";
import { middlewareAluno } from "../auth-aluno.js";

const router = express.Router();

/* ============================================================
   ALUNO — cria solicitação
   ============================================================ */
router.post("/documentos/solicitar", middlewareAluno, async (req, res) => {
  const { tipo_documento, motivo, urgente } = req.body;

  if (!tipo_documento) {
    return res.status(400).json({ erro: "Tipo de documento obrigatório" });
  }

  const { data, error } = await adminClient
    .from("solicitacoes_doc")
    .insert([{
      aluno_matricula: req.user.matricula,
      aluno_nome: req.user.nome,
      aluno_turma: req.user.turma || null,
      tipo_documento,
      motivo: motivo || null,
      urgente: !!urgente,
      status: "pendente",
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   ALUNO — lista suas solicitações
   ============================================================ */
router.get("/documentos/minhas", middlewareAluno, async (req, res) => {
  const { data, error } = await adminClient
    .from("solicitacoes_doc")
    .select("*")
    .eq("aluno_matricula", req.user.matricula)
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* ============================================================
   SECRETARIA/ADMIN — lista todas
   ============================================================ */
router.get("/documentos/todas", middlewareAuth, async (req, res) => {
  const { status } = req.query;
  let query = adminClient
    .from("solicitacoes_doc")
    .select("*")
    .order("urgente", { ascending: false })
    .order("criado_em", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* ============================================================
   SECRETARIA — atualiza status
   ============================================================ */
router.put("/documentos/:id/status", middlewareAuth, async (req, res) => {
  const { status, observacao, prazo_retirada } = req.body;

  const update = {
    status,
    observacao: observacao || null,
    prazo_retirada: prazo_retirada || null,
    respondido_por: req.user.id,
    respondido_em: new Date().toISOString(),
  };

  if (status === "entregue") {
    update.entregue_em = new Date().toISOString();
  }

  const { data, error } = await adminClient
    .from("solicitacoes_doc")
    .update(update)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   ESTATÍSTICAS
   ============================================================ */
router.get("/documentos/stats", middlewareAuth, async (req, res) => {
  const { data } = await adminClient.from("solicitacoes_doc").select("status");

  const stats = {
    total: data?.length || 0,
    pendente: data?.filter((d) => d.status === "pendente").length || 0,
    preparando: data?.filter((d) => d.status === "preparando").length || 0,
    pronto: data?.filter((d) => d.status === "pronto").length || 0,
    entregue: data?.filter((d) => d.status === "entregue").length || 0,
  };

  res.json(stats);
});

export default router;
