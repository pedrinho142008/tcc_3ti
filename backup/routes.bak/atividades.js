import express from "express";
import multer from "multer";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
const BUCKET = "atividades";

/* ---------- UPLOAD ---------- */
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

/* ---------- PROFESSORES ---------- */
router.get("/professores/lista", async (req, res) => {
  const { data, error } = await adminClient
    .from("users")
    .select("id, nome, cargo, email")
    .eq("ativo", true)
    .order("nome");
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ---------- ENVIOS ---------- */

router.get("/envios/listar", middlewareAuth, async (req, res) => {
  const { atividade_id, turma, aluno_matricula } = req.query;

  let query = adminClient
    .from("envios")
    .select("*")
    .order("criado_em", { ascending: false });

  if (atividade_id) query = query.eq("atividade_id", atividade_id);
  if (turma) query = query.eq("turma", turma);
  if (aluno_matricula) query = query.eq("aluno_matricula", aluno_matricula);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.post("/envios", middlewareAuth, async (req, res) => {
  const body = req.body;

  if (!body.aluno_matricula || !body.aluno_nome || !body.turma || !body.titulo) {
    return res.status(400).json({ erro: "Aluno, turma e título são obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("envios")
    .insert([{
      atividade_id: body.atividade_id || null,
      professor_id: body.professor_id || null,
      professor_nome: body.professor_nome || null,
      aluno_matricula: body.aluno_matricula,
      aluno_nome: body.aluno_nome,
      turma: body.turma,
      titulo: body.titulo,
      descricao: body.descricao || null,
      arquivo_url: body.arquivo_url || null,
      arquivo_tipo: body.arquivo_tipo || null,
      arquivo_nome: body.arquivo_nome || null,
      arquivo_tamanho: body.arquivo_tamanho || null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.put("/envios/:id/corrigir", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { nota, comentario_professor } = req.body;

  const { data, error } = await adminClient
    .from("envios")
    .update({
      nota,
      comentario_professor,
      status: "corrigido",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.put("/envios/:id/visualizar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient
    .from("envios")
    .update({ status: "visualizado" })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/envios/:id", middlewareAuth, async (req, res) => {
  const { error } = await adminClient.from("envios").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

/* ---------- ATIVIDADES ---------- */

router.get("/", async (req, res) => {
  const { turma } = req.query;
  let query = adminClient
    .from("atividades")
    .select("*")
    .eq("ativo", true)
    .order("criado_em", { ascending: false });

  if (turma) query = query.eq("turma", turma);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.post("/", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { titulo, descricao, turma, arquivo_url, arquivo_tipo, prazo } = req.body;
  if (!titulo || !turma) return res.status(400).json({ erro: "Título e turma obrigatórios" });

  const { data, error } = await adminClient
    .from("atividades")
    .insert([{
      professor_id: req.user.id,
      professor_nome: req.user.nome,
      titulo,
      descricao: descricao || null,
      turma,
      arquivo_url: arquivo_url || null,
      arquivo_tipo: arquivo_tipo || null,
      prazo: prazo || null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/:id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { error } = await adminClient.from("atividades").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
