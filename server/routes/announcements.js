import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareAdmin } from "../auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { data, error } = await publicClient.from("announcements")
    .select("*").eq("ativo", true)
    .order("urgente", { ascending: false })
    .order("criado_em", { ascending: false }).limit(5);
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.post("/", middlewareAdmin, async (req, res) => {
  const { texto, urgente } = req.body;
  if (!texto) return res.status(400).json({ erro: "Texto obrigatório" });
  const { data, error } = await adminClient.from("announcements")
    .insert([{ texto, urgente: !!urgente, autor_id: req.user.id }])
    .select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/:id", middlewareAdmin, async (req, res) => {
  const { error } = await adminClient.from("announcements").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
