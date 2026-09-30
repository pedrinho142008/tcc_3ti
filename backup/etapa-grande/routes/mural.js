import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

/* ============================================================
   Lista avisos do mural (público — filtrado por público)
   ============================================================ */
router.get("/mural", async (req, res) => {
  const { publico } = req.query;

  let query = publicClient
    .from("mural_avisos")
    .select("*")
    .order("fixado", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(50);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });

  let avisos = data || [];

  // Filtra por público (se especificado)
  if (publico) {
    const publicos = publico.split(",").map((p) => p.trim());
    avisos = avisos.filter((a) => {
      const lista = a.publico || ["todos"];
      if (lista.includes("todos")) return true;
      return publicos.some((p) => lista.includes(p));
    });
  }

  // Remove expirados
  const agora = new Date();
  avisos = avisos.filter((a) => !a.expira_em || new Date(a.expira_em) > agora);

  res.json(avisos);
});

/* ============================================================
   Criar aviso (admin/funcionário)
   ============================================================ */
router.post("/mural", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { titulo, texto, categoria, publico, fixado, expira_em } = req.body;

  if (!titulo || !texto) {
    return res.status(400).json({ erro: "Título e texto são obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("mural_avisos")
    .insert([{
      titulo,
      texto,
      categoria: categoria || "aviso",
      publico: publico && publico.length ? publico : ["todos"],
      fixado: !!fixado,
      expira_em: expira_em || null,
      autor_id: req.user.id,
      autor_nome: req.user.nome,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   Deletar aviso
   ============================================================ */
router.delete("/mural/:id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { error } = await adminClient.from("mural_avisos").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

/* ============================================================
   Lista de públicos disponíveis (pro frontend)
   ============================================================ */
router.get("/mural/publicos", (req, res) => {
  res.json([
    { valor: "todos", label: "🌎 Todos" },
    { valor: "alunos", label: "👨‍🎓 Todos os alunos" },
    { valor: "professores", label: "👨‍🏫 Professores" },
    { valor: "funcionarios", label: "💼 Funcionários" },
    { valor: "pais", label: "👨‍👩‍👧 Pais/Responsáveis" },
    { valor: "1º Ano", label: "📚 1º Ano" },
    { valor: "2º Ano", label: "📚 2º Ano" },
    { valor: "3º Ano", label: "📚 3º Ano" },
  ]);
});

export default router;
