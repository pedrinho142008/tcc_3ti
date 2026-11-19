import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

const CATEGORIAS_ADMIN = ["aviso", "urgente", "evento", "reuniao", "feriado"];
const CATEGORIAS_PROF = ["prova"];

router.get("/mural", async (req, res) => {
  const { publico } = req.query;

  const { data, error } = await publicClient
    .from("mural_avisos").select("*")
    .order("fixado", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ erro: error.message });

  let avisos = data || [];

  if (publico) {
    const publicos = publico.split(",").map((p) => p.trim());
    avisos = avisos.filter((a) => {
      const lista = a.publico || ["todos"];
      if (lista.includes("todos")) return true;
      return publicos.some((p) => lista.includes(p));
    });
  }

  const agora = new Date();
  avisos = avisos.filter((a) => !a.expira_em || new Date(a.expira_em) > agora);

  res.json(avisos);
});

router.post("/mural", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { titulo, texto, categoria, publico, publico_turmas, fixado, expira_em } = req.body;

  if (!titulo || !texto) {
    return res.status(400).json({ erro: "Título e texto são obrigatórios" });
  }

  if (req.user.tipo === "admin") {
    if (!CATEGORIAS_ADMIN.includes(categoria)) {
      return res.status(400).json({ erro: "Admin só pode usar: " + CATEGORIAS_ADMIN.join(", ") });
    }
  } else if (req.user.tipo === "professor") {
    if (!CATEGORIAS_PROF.includes(categoria)) {
      return res.status(400).json({ erro: "Professor só pode criar 'prova'" });
    }
    if (!publico_turmas || publico_turmas.length === 0) {
      return res.status(400).json({ erro: "Escolha ao menos uma turma" });
    }
  } else {
    return res.status(403).json({ erro: "Sem permissão" });
  }

  const { data, error } = await adminClient
    .from("mural_avisos")
    .insert([{
      titulo, texto,
      categoria: categoria || "aviso",
      publico: publico && publico.length ? publico : ["todos"],
      publico_turmas: publico_turmas || [],
      fixado: !!fixado,
      expira_em: expira_em || null,
      autor_id: req.user.id,
      autor_nome: req.user.nome,
    }])
    .select().single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/mural/:id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { error } = await adminClient.from("mural_avisos").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

router.get("/mural/publicos", (req, res) => {
  res.json([
    { valor: "todos", label: "🌎 Todos" },
    { valor: "alunos", label: "👨‍🎓 Alunos" },
    { valor: "professores", label: "👨‍🏫 Professores" },
    { valor: "funcionarios", label: "💼 Funcionários" },
    { valor: "pais", label: "👨‍👩‍👧 Pais/Responsáveis" },
  ]);
});

router.get("/mural/turmas", middlewareAuth, middlewareFuncionario, (req, res) => {
  res.json([
    "1º Ano A", "1º Ano T.I",
    "2º Ano A", "2º Ano T.I",
    "3º Ano A", "3º Ano T.I",
  ]);
});

export default router;
