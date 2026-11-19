import express from "express";
import jwt from "jsonwebtoken";
import { adminClient } from "../supabase.js";
import { SigEducClient } from "../scraper/client.js";
import { parseBoletim } from "../scraper/boletim.js";
import { parsePerfil, parseProfessores } from "../scraper/professores.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || "dev-secret-mude-isto";
const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

const sessoes = new Map();
const SESSAO_TTL = 4 * 60 * 60 * 1000;

setInterval(() => {
  const agora = Date.now();
  for (const [matricula, sessao] of sessoes.entries()) {
    if (agora - sessao.criadoEm > SESSAO_TTL) sessoes.delete(matricula);
  }
}, 10 * 60 * 1000);

/* ============================================================
   LOGIN
   ============================================================ */
router.post("/login", async (req, res) => {
  const { matricula, senha } = req.body;

  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  const valorNumerico = String(matricula).trim().replace(/\D/g, "");

  if (valorNumerico.length < 6) {
    return res.status(400).json({
      erro: "Digite uma matrícula (12 dígitos) ou CPF (11 dígitos).",
    });
  }

  let matriculaFinal;
  let tipoLogin;

  if (valorNumerico.length === 11) {
    matriculaFinal = valorNumerico.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      "$1.$2.$3-$4"
    );
    tipoLogin = "CPF";
  } else {
    matriculaFinal = valorNumerico;
    tipoLogin = "Matrícula";
  }

  const t0 = Date.now();
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`🎓 [ALUNO LOGIN] ${tipoLogin}: ${matriculaFinal}`);
  console.log(`══════════════════════════════════════════════════`);

  try {
    const c = new SigEducClient();

    console.log(`📋 [1/5] Autenticando...`);
    const t1 = Date.now();
    const ok = await c.login(matriculaFinal, senha);
    if (!ok) {
      console.log(`❌ Login falhou (${Date.now() - t1}ms)`);
      return res.status(401).json({ erro: "Matrícula/CPF ou senha incorretos" });
    }
    console.log(`✅ Login OK (${Date.now() - t1}ms)`);

    console.log(`📋 [2/5] Escolhendo vínculo...`);
    const t2 = Date.now();
    await c.escolherVinculoAutomatico();
    console.log(`✅ Vínculo ${c.vinculoAtivo} OK (${Date.now() - t2}ms)`);

    console.log(`📋 [3/5] Abrindo portal...`);
    const t3 = Date.now();
    const htmlPortal = await c.portal();
    console.log(`✅ Portal OK — ${htmlPortal.length} bytes (${Date.now() - t3}ms)`);

    if (htmlPortal.length < 1000) {
      return res.status(401).json({
        erro: "Não conseguimos abrir o portal. Verifique os dados e tente novamente.",
      });
    }

    console.log(`📋 [4/5] Extraindo perfil...`);
    const perfil = parsePerfil(htmlPortal);
    const professores = parseProfessores(htmlPortal);
    const nomeAluno = perfil.nome || `Aluno ${matriculaFinal}`;
    console.log(`✅ Perfil: ${nomeAluno}`);

    console.log(`📋 [5/5] Buscando boletim...`);
    let boletim = null;
    try {
      const htmlBoletim = await c.boletim();
      const parsed = parseBoletim(htmlBoletim);

      if (parsed?.disciplinas?.length > 0) {
        boletim = parsed;
        for (const d of boletim.disciplinas) {
          const meta = professores[d.nome] || {};
          d.professor = meta.professor || "—";
          d.horario = meta.horario || "—";
        }
        console.log(`✅ Boletim OK — ${boletim.disciplinas.length} disciplinas`);

        const matSalvar = perfil.matrícula || perfil.matricula || valorNumerico;
        adminClient
          .from("alunos")
          .update({ boletim, atualizado_em: new Date().toISOString() })
          .eq("matricula", matSalvar)
          .then(() => {})
          .catch(() => {});
      } else {
        console.log(`⚠️ Parser retornou 0 disciplinas`);
      }
    } catch (e) {
      console.error(`⚠️ Boletim falhou: ${e.message}`);
    }

    sessoes.set(valorNumerico, {
      client: c,
      perfil,
      professores,
      boletim,
      boletimCarregando: false,
      criadoEm: Date.now(),
    });

    let alunoId = null;
    try {
      const matSalvar = perfil.matrícula || perfil.matricula || valorNumerico;
      const { data: existente } = await adminClient
        .from("alunos").select("id").eq("matricula", matSalvar).maybeSingle();
      if (existente) alunoId = existente.id;
      else {
        const { data: novo } = await adminClient
          .from("alunos")
          .insert([{ matricula: matSalvar, nome: nomeAluno, turma: perfil.turma || null }])
          .select().single();
        alunoId = novo?.id;
      }
    } catch {}

    const token = jwt.sign(
      {
        id: alunoId || valorNumerico,
        matricula: valorNumerico,
        nome: nomeAluno,
        tipo: "aluno",
      },
      SECRET,
      { expiresIn: "30d" }
    );

    res.cookie("token_aluno", token, COOKIE_OPTS);
    res.json({
      id: alunoId || valorNumerico,
      matricula: valorNumerico,
      nome: nomeAluno,
      turma: perfil.turma || null,
      tipo: "aluno",
      perfil,
      temBoletim: !!boletim,
    });

    const total = Date.now() - t0;
    console.log(`✅ LOGIN COMPLETO (${total}ms)\n`);
  } catch (e) {
    console.error(`❌ ERRO:`, e.message);
    res.status(500).json({
      erro: "Falha ao conectar no SigEduc. Tente novamente.",
      detalhe: e.message,
    });
  }
});

/* ============================================================
   BOLETIM
   ============================================================ */
router.get("/boletim", async (req, res) => {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  const { matricula } = payload;
  const sessao = sessoes.get(matricula);

  if (sessao?.boletim?.disciplinas?.length > 0) return res.json(sessao.boletim);

  try {
    const { data } = await adminClient
      .from("alunos").select("boletim").eq("matricula", matricula).maybeSingle();
    if (data?.boletim?.disciplinas?.length > 0) {
      if (sessao) sessao.boletim = data.boletim;
      return res.json(data.boletim);
    }
  } catch {}

  if (sessao?.client && !sessao._boletimFalhou) {
    try {
      const htmlBoletim = await sessao.client.boletim();
      const parsed = parseBoletim(htmlBoletim);
      if (parsed?.disciplinas?.length > 0) {
        for (const d of parsed.disciplinas) {
          const meta = sessao.professores[d.nome] || {};
          d.professor = meta.professor || "—";
        }
        sessao.boletim = parsed;
        return res.json(parsed);
      }
      sessao._boletimFalhou = true;
    } catch (e) {
      sessao._boletimFalhou = true;
      console.error(`❌ Erro busca:`, e.message);
    }
  }

  return res.status(202).json({
    status: "carregando",
    erro: "O boletim ainda não foi carregado.",
  });
});

/* ============================================================
   RECARREGAR
   ============================================================ */
router.post("/boletim/recarregar", async (req, res) => {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  const sessao = sessoes.get(payload.matricula);
  if (!sessao?.client) {
    return res.status(401).json({ erro: "Faça login novamente." });
  }

  try {
    sessao._boletimFalhou = false;
    const htmlBoletim = await sessao.client.boletim();
    const parsed = parseBoletim(htmlBoletim);
    if (parsed?.disciplinas?.length > 0) {
      for (const d of parsed.disciplinas) {
        const meta = sessao.professores[d.nome] || {};
        d.professor = meta.professor || "—";
      }
      sessao.boletim = parsed;
      sessao.criadoEm = Date.now();
      res.json(parsed);
    } else {
      sessao._boletimFalhou = true;
      res.status(500).json({ erro: "O parser não conseguiu extrair o boletim." });
    }
  } catch (e) {
    sessao._boletimFalhou = true;
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   PERFIL / LOGOUT / ME
   ============================================================ */
router.get("/perfil", (req, res) => {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });
  try {
    const payload = jwt.verify(token, SECRET);
    const sessao = sessoes.get(payload.matricula);
    if (sessao?.perfil) return res.json(sessao.perfil);
    res.status(404).json({ erro: "Perfil não encontrado" });
  } catch {
    res.status(401).json({ erro: "Sessão expirada" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token_aluno", { path: "/" });
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });
  try {
    res.json(jwt.verify(token, SECRET));
  } catch {
    res.status(401).json({ erro: "Sessão expirada" });
  }
});

export default router;
