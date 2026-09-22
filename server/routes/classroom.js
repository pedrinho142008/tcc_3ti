import express from "express";
import multer from "multer";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
const BUCKET = "atividades_turma";

/* ============================================================
   UPLOAD de arquivo
   ============================================================ */
router.post("/upload", middlewareAuth, upload.single("arquivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo" });

    const ext = req.file.originalname.split(".").pop().toLowerCase();
    const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await adminClient.storage
      .from(BUCKET)
      .upload(nome, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) return res.status(500).json({ erro: error.message });

    const { data: pub } = adminClient.storage.from(BUCKET).getPublicUrl(nome);

    res.json({
      url: pub.publicUrl,
      nome: req.file.originalname,
      tipo: req.file.mimetype,
      tamanho: req.file.size,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   ATIVIDADES
   ============================================================ */

router.get("/atividades", async (req, res) => {
  const { turma } = req.query;

  let query = adminClient
    .from("atividades_com_stats")
    .select("*")
    .order("criado_em", { ascending: false });

  if (turma) query = query.eq("turma", turma);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.get("/minhas-atividades", middlewareAuth, async (req, res) => {
  const { data, error } = await adminClient
    .from("atividades_com_stats")
    .select("*")
    .eq("professor_id", req.user.id)
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.get("/atividades/:id", async (req, res) => {
  const { data, error } = await adminClient
    .from("atividades_turma")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ erro: "Atividade não encontrada" });
  res.json(data);
});

router.post("/atividades", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { titulo, descricao, turma, arquivo_url, arquivo_tipo, arquivo_nome, prazo } = req.body;

  if (!titulo || !turma) {
    return res.status(400).json({ erro: "Título e turma são obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("atividades_turma")
    .insert([{
      professor_id: req.user.id,
      professor_nome: req.user.nome,
      turma,
      titulo,
      descricao: descricao || null,
      arquivo_url: arquivo_url || null,
      arquivo_tipo: arquivo_tipo || null,
      arquivo_nome: arquivo_nome || null,
      prazo: prazo || null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.put("/atividades/:id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { titulo, descricao, prazo } = req.body;

  const { data, error } = await adminClient
    .from("atividades_turma")
    .update({ titulo, descricao, prazo })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/atividades/:id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { error } = await adminClient
    .from("atividades_turma")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

/* ============================================================
   COMENTÁRIOS
   ============================================================ */

router.get("/atividades/:id/comentarios", async (req, res) => {
  const { data, error } = await adminClient
    .from("comentarios_atividade")
    .select("*")
    .eq("atividade_id", req.params.id)
    .order("criado_em", { ascending: true });

  if (error) return res.status(500).json({ erro: error.message });

  const comentariosComReacoes = await Promise.all(
    (data || []).map(async (c) => {
      const { data: reacoes } = await adminClient
        .from("reacoes_comentario")
        .select("emoji, autor_matricula")
        .eq("comentario_id", c.id);

      const agrupado = {};
      for (const r of reacoes || []) {
        if (!agrupado[r.emoji]) agrupado[r.emoji] = [];
        agrupado[r.emoji].push(r.autor_matricula);
      }

      return { ...c, reacoes: agrupado };
    })
  );

  res.json(comentariosComReacoes);
});

router.post("/comentarios", middlewareAuth, async (req, res) => {
  const { atividade_id, texto, autor_tipo, autor_nome, autor_matricula } = req.body;

  if (!atividade_id || !texto || !texto.trim()) {
    return res.status(400).json({ erro: "Atividade e texto são obrigatórios" });
  }

  const tipo = autor_tipo || (req.user.tipo === "aluno" ? "aluno" : "professor");
  const nome = autor_nome || req.user.nome;
  const matricula = autor_matricula || req.user.matricula || null;

  const { data, error } = await adminClient
    .from("comentarios_atividade")
    .insert([{
      atividade_id,
      autor_tipo: tipo,
      autor_nome: nome,
      autor_matricula: matricula,
      autor_id: req.user.tipo === "aluno" ? null : req.user.id,
      texto: texto.trim(),
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/comentarios/:id", middlewareAuth, async (req, res) => {
  const { error } = await adminClient
    .from("comentarios_atividade")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

/* ============================================================
   REAÇÕES
   ============================================================ */

router.post("/reacoes", middlewareAuth, async (req, res) => {
  const { comentario_id, emoji, autor_matricula } = req.body;

  if (!comentario_id || !emoji) {
    return res.status(400).json({ erro: "Comentário e emoji são obrigatórios" });
  }

  const matricula = autor_matricula || req.user.matricula || req.user.id;

  const { data: existente } = await adminClient
    .from("reacoes_comentario")
    .select("id")
    .eq("comentario_id", comentario_id)
    .eq("autor_matricula", matricula)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existente) {
    await adminClient
      .from("reacoes_comentario")
      .delete()
      .eq("id", existente.id);

    return res.json({ ok: true, removido: true });
  }

  const { error } = await adminClient
    .from("reacoes_comentario")
    .insert([{ comentario_id, emoji, autor_matricula: matricula }]);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true, adicionado: true });
});

export default router;
