import express from "express";
import jwt from "jsonwebtoken";
import { adminClient } from "../supabase.js";

const router = express.Router();
const SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  "dev-secret-mude-isto";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
};

/* ---------- LOGIN ---------- */
router.post("/login", async (req, res) => {
  const { matricula, senha } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  // Busca aluno existente
  let { data: aluno } = await adminClient
    .from("alunos")
    .select("*")
    .eq("matricula", matricula)
    .single();

  // Se não existir, cria
  if (!aluno) {
    const { data: novo, error } = await adminClient
      .from("alunos")
      .insert([{
        matricula,
        nome: `Aluno ${matricula}`,
        senha_hash: senha,
        ativo: true,
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ erro: error.message });
    aluno = novo;
  }

  const token = jwt.sign(
    {
      id: aluno.id,
      matricula: aluno.matricula,
      nome: aluno.nome,
      tipo: "aluno",
    },
    SECRET,
    { expiresIn: "8h" }
  );

  res.cookie("token_aluno", token, COOKIE_OPTS);
  res.json({
    id: aluno.id,
    matricula: aluno.matricula,
    nome: aluno.nome,
    turma: aluno.turma || null,
    tipo: "aluno",
  });
});

/* ---------- LOGOUT ---------- */
router.post("/logout", (req, res) => {
  res.clearCookie("token_aluno", COOKIE_OPTS);
  res.json({ ok: true });
});

/* ---------- SESSÃO ATUAL ---------- */
router.get("/me", (req, res) => {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  try {
    const payload = jwt.verify(token, SECRET);
    res.json(payload);
  } catch {
    res.status(401).json({ erro: "Sessão expirada" });
  }
});

export default router;
