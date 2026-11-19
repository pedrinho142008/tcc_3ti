import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareAuth, middlewareAdmin } from "../auth.js";

const router = express.Router();

/* ============================================================
   Atualiza contador de curtidas/comentários (sem RPC)
   ============================================================ */
async function contarCurtidas(postId) {
  const { count } = await adminClient
    .from("curtidas_posts")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  return count || 0;
}

async function contarComentarios(postId) {
  const { count } = await adminClient
    .from("comentarios_posts")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  return count || 0;
}

/* ============================================================
   LISTAR POSTS (público)
   ============================================================ */
router.get("/", async (req, res) => {
  const { data, error } = await publicClient
    .from("posts")
    .select("*")
    .eq("publicado", true)
    .order("fixada", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   CRIAR POST (admin)
   ============================================================ */
router.post("/", middlewareAuth, middlewareAdmin, async (req, res) => {
  const {
    titulo, texto, imagem_url, imagens,
    categoria, fixada, importado_de,
    curtidas_ativas, comentarios_ativos,
  } = req.body;

  if (!titulo || !texto) {
    return res.status(400).json({ erro: "Título e texto obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("posts")
    .insert([{
      titulo,
      texto,
      imagem_url: imagem_url || null,
      imagens: imagens || [],
      categoria: categoria || "noticia",
      fixada: !!fixada,
      importado_de: importado_de || null,
      curtidas_ativas: curtidas_ativas !== false,
      comentarios_ativos: comentarios_ativos !== false,
      autor_id: req.user.id,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   EDITAR POST (admin)
   ============================================================ */
router.put("/:id", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient
    .from("posts")
    .update(req.body)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   DELETAR POST (admin)
   ============================================================ */
router.delete("/:id", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { error } = await adminClient.from("posts").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

/* ============================================================
   CURTIR / DESCURTIR
   ============================================================ */
router.post("/:id/curtir", async (req, res) => {
  try {
    const { autor_tipo, autor_id, autor_nome } = req.body;
    if (!autor_tipo || !autor_id) {
      return res.status(400).json({ erro: "Identificação obrigatória" });
    }

    const { data: post } = await adminClient
      .from("posts")
      .select("curtidas_ativas")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!post) return res.status(404).json({ erro: "Post não encontrado" });
    if (!post.curtidas_ativas) {
      return res.status(403).json({ erro: "Curtidas desativadas nesta postagem" });
    }

    const { data: existente } = await adminClient
      .from("curtidas_posts")
      .select("id")
      .eq("post_id", req.params.id)
      .eq("autor_tipo", autor_tipo)
      .eq("autor_id", autor_id)
      .maybeSingle();

    let curtido;

    if (existente) {
      await adminClient.from("curtidas_posts").delete().eq("id", existente.id);
      curtido = false;
    } else {
      await adminClient.from("curtidas_posts").insert([{
        post_id: req.params.id,
        autor_tipo,
        autor_id,
        autor_nome: autor_nome || "Anônimo",
      }]);
      curtido = true;
    }

    // Atualiza contador na tabela posts
    const total = await contarCurtidas(req.params.id);
    await adminClient
      .from("posts")
      .update({ curtidas_count: total })
      .eq("id", req.params.id);

    res.json({ ok: true, curtido, total });
  } catch (e) {
    console.error("Erro em /curtir:", e);
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   COMENTÁRIOS
   ============================================================ */
router.get("/:id/comentarios", async (req, res) => {
  const { data, error } = await adminClient
    .from("comentarios_posts")
    .select("*")
    .eq("post_id", req.params.id)
    .order("criado_em", { ascending: true });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

router.post("/:id/comentarios", async (req, res) => {
  try {
    const { autor_tipo, autor_id, autor_nome, autor_avatar, texto } = req.body;

    if (!texto?.trim()) return res.status(400).json({ erro: "Texto obrigatório" });
    if (!autor_nome) return res.status(400).json({ erro: "Nome obrigatório" });

    const { data: post } = await adminClient
      .from("posts")
      .select("comentarios_ativos")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!post) return res.status(404).json({ erro: "Post não encontrado" });
    if (!post.comentarios_ativos) {
      return res.status(403).json({ erro: "Comentários desativados nesta postagem" });
    }

    const { data, error } = await adminClient
      .from("comentarios_posts")
      .insert([{
        post_id: req.params.id,
        autor_tipo: autor_tipo || "visitante",
        autor_id: autor_id || null,
        autor_nome,
        autor_avatar: autor_avatar || null,
        texto: texto.trim(),
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ erro: error.message });

    // Atualiza contador
    const total = await contarComentarios(req.params.id);
    await adminClient
      .from("posts")
      .update({ comentarios_count: total })
      .eq("id", req.params.id);

    res.json(data);
  } catch (e) {
    console.error("Erro em /comentarios:", e);
    res.status(500).json({ erro: e.message });
  }
});

router.delete("/:id/comentarios/:comentarioId", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { error } = await adminClient
    .from("comentarios_posts")
    .delete()
    .eq("id", req.params.comentarioId);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
