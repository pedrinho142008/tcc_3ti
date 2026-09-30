import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth } from "../auth.js";
import { middlewareAluno } from "../auth-aluno.js";

const router = express.Router();

/* LISTAR anotações do aluno */
router.get("/aluno/anotacoes", middlewareAluno, async (req, res) => {
  const { matricula } = req.query;
  const mat = matricula || req.user?.matricula;
  if (!mat) return res.status(400).json({ erro: "Matrícula obrigatória" });

  const { data, error } = await adminClient
    .from("anotacoes_aluno")
    .select("*")
    .eq("aluno_matricula", mat)
    .order("prioridade", { ascending: false })
    .order("data_entrega", { ascending: true, nullsFirst: false })
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* CRIAR anotação */
router.post("/aluno/anotacoes", middlewareAluno, async (req, res) => {
  const { aluno_matricula, tipo, titulo, conteudo, materia, data_entrega, prioridade } = req.body;

  if (!aluno_matricula || !titulo || !tipo) {
    return res.status(400).json({ erro: "Matrícula, título e tipo obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("anotacoes_aluno")
    .insert([{
      aluno_matricula,
      tipo,
      titulo,
      conteudo: conteudo || null,
      materia: materia || null,
      data_entrega: data_entrega || null,
      prioridade: prioridade || "normal",
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ATUALIZAR (toggle concluído, etc) */
router.put("/aluno/anotacoes/:id", middlewareAluno, async (req, res) => {
  const { data, error } = await adminClient
    .from("anotacoes_aluno")
    .update(req.body)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* DELETAR */
router.delete("/aluno/anotacoes/:id", middlewareAluno, async (req, res) => {
  const { error } = await adminClient
    .from("anotacoes_aluno")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
