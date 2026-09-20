import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareAdmin } from "../auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { data, error } = await publicClient.from("events").select("*")
    .order("data_inicio", { ascending: false });
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.post("/", middlewareAdmin, async (req, res) => {
  const { titulo, descricao, local, data_inicio, data_fim } = req.body;
  if (!titulo || !data_inicio) return res.status(400).json({ erro: "Título e data obrigatórios" });
  const { data, error } = await adminClient.from("events")
    .insert([{ titulo, descricao, local, data_inicio, data_fim, autor_id: req.user.id }])
    .select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/:id", middlewareAdmin, async (req, res) => {
  const { error } = await adminClient.from("events").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
