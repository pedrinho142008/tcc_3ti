import express from "express";
import { adminClient } from "../supabase.js";
import { hashSenha, verificarSenha, gerarToken, middlewareAuth, middlewareAdmin } from "../auth.js";

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
  maxAge: 8 * 60 * 60 * 1000,
};

router.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Email e senha obrigatórios" });

  const { data: user } = await adminClient.from("users").select("*")
    .eq("email", email.toLowerCase()).eq("ativo", true).single();

  if (!user) return res.status(401).json({ erro: "Usuário não encontrado" });
  if (!verificarSenha(senha, user.senha_hash)) return res.status(401).json({ erro: "Senha incorreta" });

  const token = gerarToken(user);
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ id: user.id, nome: user.nome, email: user.email, tipo: user.tipo, cargo: user.cargo });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  res.json({ ok: true });
});

router.get("/me", middlewareAuth, (req, res) => res.json(req.user));

router.post("/", middlewareAdmin, async (req, res) => {
  const { email, nome, senha, tipo, cargo } = req.body;
  if (!email || !nome || !senha || !tipo) return res.status(400).json({ erro: "Campos obrigatórios" });
  const { data, error } = await adminClient.from("users").insert([{
    email: email.toLowerCase(), nome, tipo, cargo, senha_hash: hashSenha(senha),
  }]).select("id, email, nome, tipo, cargo").single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.get("/", middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient.from("users")
    .select("id, email, nome, tipo, cargo, ativo, criado_em")
    .order("criado_em", { ascending: false });
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

export default router;
