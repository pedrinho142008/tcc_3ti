import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareAdmin } from "../auth.js";

const router = express.Router();
const SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  "dev-secret-mude-isto";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

/* ============================================================
   CADASTRO DO RESPONSÁVEL (com matrícula do aluno)
   ============================================================ */
router.post("/cadastro", async (req, res) => {
  const { nome, email, senha, telefone, parentesco, matricula_aluno } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Nome, email e senha obrigatórios" });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const { data: existente } = await adminClient
      .from("responsaveis")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();

    if (existente) {
      return res.status(400).json({ erro: "Este email já está cadastrado" });
    }

    // Verifica se o aluno existe
    let aluno = null;
    if (matricula_aluno) {
      const { data: a } = await adminClient
        .from("alunos")
        .select("matricula, nome, turma")
        .eq("matricula", matricula_aluno)
        .maybeSingle();
      aluno = a;
    }

    const senha_hash = bcrypt.hashSync(senha, 10);

    const { data: responsavel, error } = await adminClient
      .from("responsaveis")
      .insert([{
        nome: nome.trim(),
        email: emailLower,
        senha_hash,
        telefone: telefone || null,
        parentesco: parentesco || null,
        aprovado: false,
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ erro: error.message });

    // Se passou matrícula, cria vínculo pendente
    let vinculo = null;
    if (aluno) {
      const { data: v } = await adminClient
        .from("vinculos_responsavel")
        .insert([{
          responsavel_id: responsavel.id,
          aluno_matricula: aluno.matricula,
          aluno_nome: aluno.nome,
          status: "pendente",
        }])
        .select()
        .single();
      vinculo = v;
    }

    res.json({
      ok: true,
      mensagem: "Cadastro enviado! Aguarde aprovação do administrador.",
      responsavel: {
        id: responsavel.id,
        nome: responsavel.nome,
        email: responsavel.email,
      },
      vinculo,
      aluno_encontrado: !!aluno,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   LOGIN
   ============================================================ */
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Email e senha obrigatórios" });
  }

  const { data: responsavel } = await adminClient
    .from("responsaveis")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .eq("ativo", true)
    .maybeSingle();

  if (!responsavel) {
    return res.status(401).json({ erro: "Email não encontrado" });
  }

  if (!bcrypt.compareSync(senha, responsavel.senha_hash)) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  if (!responsavel.aprovado) {
    return res.status(403).json({
      erro: "Sua conta ainda não foi aprovada. Aguarde o administrador.",
      pendente: true,
    });
  }

  const token = jwt.sign(
    {
      id: responsavel.id,
      email: responsavel.email,
      nome: responsavel.nome,
      tipo: "responsavel",
    },
    SECRET,
    { expiresIn: "30d" }
  );

  res.cookie("token_responsavel", token, COOKIE_OPTS);
  res.json({
    id: responsavel.id,
    nome: responsavel.nome,
    email: responsavel.email,
    tipo: "responsavel",
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token_responsavel", { path: "/" });
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const token = req.cookies?.token_responsavel;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  try {
    res.json(jwt.verify(token, SECRET));
  } catch {
    res.status(401).json({ erro: "Sessão expirada" });
  }
});

/* ============================================================
   ALUNOS VINCULADOS
   ============================================================ */
router.get("/meus-alunos", (req, res) => {
  const token = req.cookies?.token_responsavel;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  adminClient
    .from("vinculos_responsavel")
    .select("*")
    .eq("responsavel_id", payload.id)
    .eq("status", "ativo")
    .then(({ data, error }) => {
      if (error) return res.status(500).json({ erro: error.message });
      res.json(data || []);
    });
});

// Vincular por matrícula (solicita aprovação)
router.post("/vincular", (req, res) => {
  const token = req.cookies?.token_responsavel;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  const { matricula } = req.body;
  if (!matricula) return res.status(400).json({ erro: "Matrícula obrigatória" });

  (async () => {
    // Verifica se aluno existe
    const { data: aluno } = await adminClient
      .from("alunos")
      .select("matricula, nome, turma")
      .eq("matricula", matricula.trim())
      .maybeSingle();

    if (!aluno) {
      return res.status(404).json({
        erro: "Matrícula não encontrada. Verifique com a secretaria da escola.",
      });
    }

    // Verifica se já tem vínculo
    const { data: jaExiste } = await adminClient
      .from("vinculos_responsavel")
      .select("id, status")
      .eq("responsavel_id", payload.id)
      .eq("aluno_matricula", aluno.matricula)
      .maybeSingle();

    if (jaExiste) {
      return res.status(400).json({
        erro: jaExiste.status === "ativo"
          ? "Você já está vinculado a este aluno"
          : "Já existe uma solicitação pendente para este aluno",
      });
    }

    const { data: v, error } = await adminClient
      .from("vinculos_responsavel")
      .insert([{
        responsavel_id: payload.id,
        aluno_matricula: aluno.matricula,
        aluno_nome: aluno.nome,
        status: "pendente",
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ erro: error.message });

    res.json({
      ok: true,
      mensagem: "Solicitação enviada! Aguarde aprovação do administrador.",
      vinculo: v,
    });
  })();
});

/* ============================================================
   ADMIN — APROVAÇÃO DE RESPONSÁVEIS
   ============================================================ */

// Lista responsáveis pendentes
router.get("/admin/pendentes", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient
    .from("responsaveis")
    .select("*")
    .eq("aprovado", false)
    .eq("ativo", true)
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });

  // Pra cada responsável, pega o vínculo
  const comVinculos = await Promise.all(
    (data || []).map(async (r) => {
      const { data: vinculos } = await adminClient
        .from("vinculos_responsavel")
        .select("*")
        .eq("responsavel_id", r.id);
      return { ...r, vinculos: vinculos || [] };
    })
  );

  res.json(comVinculos);
});

// Aprovar responsável
router.post("/admin/:id/aprovar", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { id } = req.params;

  const { error } = await adminClient
    .from("responsaveis")
    .update({
      aprovado: true,
      aprovado_em: new Date().toISOString(),
      aprovado_por: req.user.id,
    })
    .eq("id", id);

  if (error) return res.status(500).json({ erro: error.message });

  // Aprova também os vínculos
  await adminClient
    .from("vinculos_responsavel")
    .update({ status: "ativo" })
    .eq("responsavel_id", id)
    .eq("status", "pendente");

  res.json({ ok: true });
});

// Rejeitar responsável
router.post("/admin/:id/rejeitar", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  const { error } = await adminClient
    .from("responsaveis")
    .update({
      aprovado: false,
      ativo: false,
      motivo_rejeicao: motivo || "Sem motivo informado",
    })
    .eq("id", id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

// Lista todos os responsáveis (aprovados e não)
router.get("/admin/lista", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { data, error } = await adminClient
    .from("responsaveis")
    .select("id, nome, email, telefone, parentesco, aprovado, ativo, criado_em")
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

// Aprovar vínculo individual
router.post("/admin/vinculo/:id/aprovar", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { error } = await adminClient
    .from("vinculos_responsavel")
    .update({ status: "ativo" })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

// Rejeitar vínculo
router.post("/admin/vinculo/:id/rejeitar", middlewareAuth, middlewareAdmin, async (req, res) => {
  const { error } = await adminClient
    .from("vinculos_responsavel")
    .update({ status: "cancelado" })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
