import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

router.get("/lista", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { turma } = req.query;

  let query = adminClient
    .from("alunos")
    .select("id, matricula, nome, turma")
    .order("nome");

  if (turma) query = query.eq("turma", turma);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

export default router;
