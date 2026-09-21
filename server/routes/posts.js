import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareAuth, middlewareAdmin } from "../auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { data, error } = await publicClient
    .from("posts").select("*")
    .eq("publicado", true)
    .order("fixada", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.post("/", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { titulo, texto, imagem_url, categoria, fixada } = req.body;
  if (!titulo || !texto) return res.status(400).json({ erro: "Título e texto obrigatórios" });
  const { data, error } = await adminClient.from("posts").insert([{
    titulo, texto, imagem_url, categoria: categoria || "noticia",
    fixada: !!fixada, autor_id: req.user.id,
  }]).select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.put("/:id", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient.from("posts")
    .update(req.body).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/:id", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { error } = await adminClient.from("posts").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
