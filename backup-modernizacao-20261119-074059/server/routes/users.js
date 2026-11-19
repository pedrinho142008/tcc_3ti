import express from "express";
import { adminClient } from "../supabase.js";
import { hashSenha, verificarSenha, gerarToken, middlewareAuth, middlewareAdmin } from "../auth.js";

const router = express.Router();

const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
};

router.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  console.log(`\n👤 [LOGIN] email=${email}`);

  if (!email || !senha) {
    return res.status(400).json({ erro: "Email e senha obrigatórios" });
  }

  const emailLower = email.toLowerCase().trim();

  const { data: user, error } = await adminClient
    .from("users")
    .select("*")
    .eq("email", emailLower)
    .maybeSingle();

  console.log(`   → busca: ${user ? "encontrado" : "NÃO encontrado"}`);
  if (error) console.log(`   ⚠ erro:`, error.message);

  if (!user) {
    return res.status(401).json({ erro: "Usuário não encontrado. Verifique o email." });
  }

  console.log(`   → ativo=${user.ativo} aprovado=${user.aprovado} tipo=${user.tipo}`);

  if (!user.ativo) {
    return res.status(401).json({ erro: "Sua conta está desativada. Fale com o administrador." });
  }

  if (!verificarSenha(senha, user.senha_hash)) {
    console.log(`   ✗ senha incorreta`);
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  const token = gerarToken(user);
  res.cookie("token", token, COOKIE_OPTS);

  console.log(`   ✓ login OK (${user.tipo})`);

  res.json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    tipo: user.tipo,
    cargo: user.cargo,
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

router.get("/me", middlewareAuth, (req, res) => {
  res.json(req.user);
});

router.post("/", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { email, nome, senha, tipo, cargo } = req.body;
  if (!email || !nome || !senha || !tipo) {
    return res.status(400).json({ erro: "Campos obrigatórios: email, nome, senha, tipo" });
  }

  const { data, error } = await adminClient
    .from("users")
    .insert([{
      email: email.toLowerCase(),
      nome,
      tipo,
      cargo,
      senha_hash: hashSenha(senha),
      ativo: true,
      aprovado: true,
    }])
    .select("id, email, nome, tipo, cargo")
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.get("/", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient
    .from("users")
    .select("id, email, nome, tipo, cargo, ativo, criado_em")
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

export default router;
