import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth } from "../auth.js";

const router = express.Router();

/* ============================================================
   Estatísticas do mês + merenda de hoje
   ============================================================ */
router.get("/merenda/stats", middlewareAuth, async (req, res) => {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);

  const { data, error } = await adminClient
    .from("meals").select("*").gte("data", primeiroDia).order("data");

  if (error) return res.status(500).json({ erro: error.message });

  const porPeriodo = { manha: 0, almoco: 0, tarde: 0, noite: 0 };
  const porDia = {};
  for (const m of data || []) {
    porPeriodo[m.periodo] = (porPeriodo[m.periodo] || 0) + 1;
    porDia[m.data] = (porDia[m.data] || 0) + 1;
  }

  res.json({ total: data?.length || 0, porPeriodo, porDia, refeicoes: data || [] });
});

/* ============================================================
   O que a merendeira pode cadastrar HOJE
   Segunda → 1º Ano T.I
   Quarta → 3º Ano T.I
   Sexta → 2º Ano T.I
   ============================================================ */
router.get("/merenda/hoje", middlewareAuth, async (req, res) => {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex

  const mapa = {
    1: "1º Ano T.I",  // Segunda
    3: "3º Ano T.I",  // Quarta
    5: "2º Ano T.I",  // Sexta
  };

  const turmaHoje = mapa[diaSemana] || null;

  res.json({
    dia_semana: diaSemana,
    dia_nome: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][diaSemana],
    turma_hoje: turmaHoje,
    pode_cadastrar: !!turmaHoje,
    data: hoje.toISOString().slice(0, 10),
  });
});

export default router;
