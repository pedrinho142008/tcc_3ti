import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareFuncionario } from "../auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 14);
  const { data, error } = await publicClient.from("meals").select("*")
    .gte("data", inicio.toISOString().slice(0, 10))
    .order("data", { ascending: false });
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.get("/hoje", async (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await publicClient.from("meals").select("*").eq("data", hoje);
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.post("/", middlewareFuncionario, async (req, res) => {
  const { data, periodo, descricao } = req.body;
  if (!data || !periodo || !descricao) return res.status(400).json({ erro: "Campos obrigatórios" });
  const { data: r, error } = await adminClient.from("meals")
    .upsert([{ data, periodo, descricao, autor_id: req.user.id }], { onConflict: "data,periodo" })
    .select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(r);
});

router.delete("/:id", middlewareFuncionario, async (req, res) => {
  const { error } = await adminClient.from("meals").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
