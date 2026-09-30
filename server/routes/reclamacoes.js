import express from "express";
import multer from "multer";
import { adminClient } from "../supabase.js";
import { middlewareAuth } from "../auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const BUCKET = "reclamacoes";

/* ============================================================
   CRIAR RECLAMAÇÃO — faxineira/porteiro/funcionário
   ============================================================ */
router.post("/reclamacoes", middlewareAuth, upload.single("foto"), async (req, res) => {
  try {
    if (req.user.tipo === "admin") {
      return res.status(403).json({ erro: "Admin não abre reclamação" });
    }

    const { titulo, descricao, categoria, local } = req.body;

    if (!titulo) return res.status(400).json({ erro: "Título obrigatório" });

    let foto_url = null;
    if (req.file) {
      const ext = req.file.originalname.split(".").pop().toLowerCase();
      const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await adminClient.storage
        .from(BUCKET).upload(nome, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (!upErr) {
        const { data: pub } = adminClient.storage.from(BUCKET).getPublicUrl(nome);
        foto_url = pub.publicUrl;
      }
    }

    const { data, error } = await adminClient
      .from("reclamacoes")
      .insert([{
        titulo,
        descricao: descricao || null,
        categoria: categoria || "geral",
        local: local || null,
        foto_url,
        status: "pendente",
        autor_id: req.user.id,
        autor_nome: req.user.nome,
        autor_cargo: req.user.cargo || req.user.tipo,
      }])
      .select().single();

    if (error) return res.status(500).json({ erro: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   LISTAR (admin vê todas; autor vê as suas)
   ============================================================ */
router.get("/reclamacoes", middlewareAuth, async (req, res) => {
  let query = adminClient.from("reclamacoes").select("*").order("criado_em", { ascending: false });

  if (req.user.tipo !== "admin") {
    query = query.eq("autor_id", req.user.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* ============================================================
   RESOLVER (só admin)
   ============================================================ */
router.put("/reclamacoes/:id/resolver", middlewareAuth, async (req, res) => {
  if (req.user.tipo !== "admin") return res.status(403).json({ erro: "Só admin" });

  const { observacao_resolucao, status } = req.body;

  const { data, error } = await adminClient
    .from("reclamacoes")
    .update({
      status: status || "resolvido",
      resolvido_por: req.user.id,
      resolvido_em: new Date().toISOString(),
      observacao_resolucao: observacao_resolucao || null,
    })
    .eq("id", req.params.id).select().single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   ESTATÍSTICAS
   ============================================================ */
router.get("/reclamacoes/stats", middlewareAuth, async (req, res) => {
  const { data } = await adminClient.from("reclamacoes").select("status");
  res.json({
    total: data?.length || 0,
    pendente: data?.filter((d) => d.status === "pendente").length || 0,
    resolvido: data?.filter((d) => d.status === "resolvido").length || 0,
  });
});

export default router;
