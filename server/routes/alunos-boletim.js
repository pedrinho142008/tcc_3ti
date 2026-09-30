import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

/* GET /api/alunos/:matricula/boletim — cache do Supabase */
router.get("/:matricula/boletim", middlewareAuth, middlewareFuncionario, async (req, res) => {
  try {
    const { data, error } = await adminClient
      .from("alunos")
      .select("boletim")
      .eq("matricula", req.params.matricula)
      .maybeSingle();

    if (error) return res.status(500).json({ erro: error.message });
    if (!data) return res.status(404).json({ erro: "Aluno não encontrado" });

    res.json(data.boletim || { disciplinas: [], situacao: {} });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

export default router;
