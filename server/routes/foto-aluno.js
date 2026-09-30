import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth } from "../auth.js";

const router = express.Router();

/* ============================================================
   GET foto do aluno (cache no Supabase ou placeholder)
   ============================================================ */
router.get("/aluno/foto", middlewareAuth, async (req, res) => {
  const { matricula } = req.query;
  if (!matricula) return res.status(400).json({ erro: "Matrícula obrigatória" });

  try {
    const { data } = await adminClient
      .from("alunos")
      .select("foto_url")
      .eq("matricula", matricula)
      .maybeSingle();

    if (data?.foto_url) return res.json({ foto_url: data.foto_url });

    res.json({ foto_url: null });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

export default router;
