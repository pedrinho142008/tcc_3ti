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
   LOGIN — igual ao debug-aluno.mjs
   ============================================================ */
router.post("/login", async (req, res) => {
  const { matricula, senha } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  const t0 = Date.now();
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`🎓 [ALUNO LOGIN] matrícula=${matricula}`);
  console.log(`══════════════════════════════════════════════════`);

  try {
    const c = new SigEducClient();

    /* PASSO 1 — login */
    console.log(`📋 [1/5] Autenticando...`);
    const t1 = Date.now();
    const ok = await c.login(matricula, senha);
    if (!ok) {
      console.log(`❌ Login falhou (${Date.now() - t1}ms)`);
      return res.status(401).json({ erro: "Matrícula ou senha incorretos" });
    }
    console.log(`✅ Login OK (${Date.now() - t1}ms)`);

    /* PASSO 2 — vínculo */
    console.log(`📋 [2/5] Escolhendo vínculo...`);
    const t2 = Date.now();
    await c.escolherVinculoAutomatico();
    console.log(`✅ Vínculo ${c.vinculoAtivo} OK (${Date.now() - t2}ms)`);

    /* PASSO 3 — portal */
    console.log(`📋 [3/5] Abrindo portal...`);
    const t3 = Date.now();
    const htmlPortal = await c.portal();
    console.log(`✅ Portal OK — ${htmlPortal.length} bytes (${Date.now() - t3}ms)`);

    if (htmlPortal.length < 1000) {
      console.log(`❌ Portal muito pequeno`);
      return res.status(401).json({
        erro: "Não foi possível abrir o portal. Verifique matrícula e senha.",
      });
    }

    /* PASSO 4 — parse */
    console.log(`📋 [4/5] Extraindo perfil...`);
    const perfil = parsePerfil(htmlPortal);
    const professores = parseProfessores(htmlPortal);
    const nomeAluno = perfil.nome || `Aluno ${matricula}`;
    console.log(`✅ Perfil: ${nomeAluno}`);
    console.log(`✅ Professores: ${Object.keys(professores).length}`);

    /* PASSO 5 — boletim (SÍNCRONO — igual debug) */
    console.log(`📋 [5/5] Buscando boletim...`);
    const t5 = Date.now();
    let boletim = null;
    try {
      const htmlBoletim = await c.boletim();
      boletim = parseBoletim(htmlBoletim);

      for (const d of boletim.disciplinas) {
        const meta = professores[d.nome] || {};
        d.professor = meta.professor || "—";
        d.horario = meta.horario || "—";
      }

      console.log(`✅ Boletim OK — ${boletim.disciplinas.length} disciplinas (${Date.now() - t5}ms)`);

      // Salva no Supabase (não bloqueia resposta)
      adminClient
        .from("alunos")
        .update({ boletim, atualizado_em: new Date().toISOString() })
        .eq("matricula", matricula)
        .then(() => console.log(`✅ Boletim salvo no Supabase`))
        .catch(() => {});
    } catch (e) {
      console.error(`⚠️ Boletim falhou (não bloqueia login): ${e.message}`);
    }

    /* Guarda sessão em memória */
    sessoes.set(matricula, {
      client: c,
      perfil,
      professores,
      boletim,
      boletimCarregando: false,
      criadoEm: Date.now(),
    });

    /* Salva/atualiza aluno no Supabase */
    let alunoId = null;
    try {
      const { data: existente } = await adminClient
        .from("alunos").select("id").eq("matricula", matricula).maybeSingle();
      if (existente) alunoId = existente.id;
      else {
        const { data: novo } = await adminClient
          .from("alunos")
          .insert([{ matricula, nome: nomeAluno, turma: perfil.turma || null }])
          .select().single();
        alunoId = novo?.id;
      }
    } catch {}

    const token = jwt.sign(
      { id: alunoId || matricula, matricula, nome: nomeAluno, tipo: "aluno" },
      SECRET,
      { expiresIn: "30d" }
    );

    res.cookie("token_aluno", token, COOKIE_OPTS);
    res.json({
      id: alunoId || matricula,
      matricula,
      nome: nomeAluno,
      turma: perfil.turma || null,
      tipo: "aluno",
      perfil,
      temBoletim: !!boletim,
    });

    const total = Date.now() - t0;
    console.log(`══════════════════════════════════════════════════`);
    console.log(`✅ LOGIN COMPLETO (${total}ms)`);
    console.log(`══════════════════════════════════════════════════\n`);
  } catch (e) {
    const total = Date.now() - t0;
    console.error(`❌ ERRO (${total}ms):`, e.message);
    res.status(500).json({
      erro: "Falha ao conectar no SigEduc. Tente novamente.",
      detalhe: e.message,
    });
  }
});

/* ============================================================
   BOLETIM — retorna do cache (já foi carregado no login!)
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

  // 1. Cache em memória
  if (sessao?.boletim) {
    console.log(`📚 Boletim de ${matricula} — cache em memória`);
    return res.json(sessao.boletim);
  }

  // 2. Cache no Supabase
  try {
    const { data } = await adminClient
      .from("alunos").select("boletim").eq("matricula", matricula).maybeSingle();
    if (data?.boletim && Object.keys(data.boletim).length > 0) {
      console.log(`📚 Boletim de ${matricula} — cache Supabase`);
      return res.json(data.boletim);
    }
  } catch {}

  // 3. Sem cache — busca síncrona
  if (sessao?.client) {
    try {
      console.log(`🔄 Buscando boletim síncrono de ${matricula}...`);
      const htmlBoletim = await sessao.client.boletim();
      const boletim = parseBoletim(htmlBoletim);
      for (const d of boletim.disciplinas) {
        const meta = sessao.professores[d.nome] || {};
        d.professor = meta.professor || "—";
      }
      sessao.boletim = boletim;

      adminClient
        .from("alunos")
        .update({ boletim, atualizado_em: new Date().toISOString() })
        .eq("matricula", matricula)
        .then(() => {})
        .catch(() => {});

      return res.json(boletim);
    } catch (e) {
      console.error(`❌ Erro busca síncrona:`, e.message);
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
    const htmlBoletim = await sessao.client.boletim();
    const boletim = parseBoletim(htmlBoletim);
    for (const d of boletim.disciplinas) {
      const meta = sessao.professores[d.nome] || {};
      d.professor = meta.professor || "—";
    }
    sessao.boletim = boletim;
    sessao.criadoEm = Date.now();

    adminClient
      .from("alunos")
      .update({ boletim, atualizado_em: new Date().toISOString() })
      .eq("matricula", payload.matricula)
      .then(() => {})
      .catch(() => {});

    res.json(boletim);
  } catch (e) {
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
