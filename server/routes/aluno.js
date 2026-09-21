import express from "express";
import jwt from "jsonwebtoken";
import { adminClient } from "../supabase.js";
import { SigEducScraper } from "../scraper.js";
import { parseBoletim, parseProfessores } from "../parser.js";

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

// Cache de sessões do scraper (matrícula → scraper)
const sessoes = new Map();
const SESSAO_TTL = 15 * 60 * 1000;

/* ============================================================
   LOGIN — valida no SigEduc de verdade
   ============================================================ */
router.post("/login", async (req, res) => {
  const { matricula, senha } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  console.log(`\n🎓 [ALUNO LOGIN] matrícula=${matricula}`);

  try {
    const scraper = new SigEducScraper();

    console.log("   → autenticando no SigEduc...");
    const ok = await scraper.login(matricula, senha);
    if (!ok) {
      console.log("   ✗ credenciais inválidas no SigEduc");
      return res.status(401).json({ erro: "Matrícula ou senha incorretos" });
    }

    console.log("   → selecionando vínculo...");
    await scraper.escolherVinculo(1);

    console.log("   → abrindo portal...");
    const htmlPortal = await scraper.abrirPortal();
    const professores = parseProfessores(htmlPortal);

    console.log("   → buscando boletim...");
    const htmlBoletim = await scraper.buscarBoletim();
    const boletim = parseBoletim(htmlBoletim);

    // Mescla professores nas disciplinas
    boletim.disciplinas = boletim.disciplinas.map((d) => {
      const meta = professores[d.nome] || {};
      return {
        ...d,
        professor: meta.professor || "—",
        horario: meta.horario || "—",
      };
    });

    // Nome do aluno (vem do boletim ou fallback)
    const nomeAluno = boletim.aluno?.nome || `Aluno ${matricula}`;

    // Salva/atualiza o aluno no Supabase
    let { data: aluno } = await adminClient
      .from("alunos")
      .select("*")
      .eq("matricula", matricula)
      .single();

    if (!aluno) {
      const { data: novo } = await adminClient
        .from("alunos")
        .insert([{
          matricula,
          nome: nomeAluno,
          turma: boletim.turma?.turma || null,
          ativo: true,
        }])
        .select()
        .single();
      aluno = novo;
    } else if (aluno.nome !== nomeAluno) {
      await adminClient
        .from("alunos")
        .update({ nome: nomeAluno, turma: boletim.turma?.turma || null })
        .eq("id", aluno.id);
      aluno.nome = nomeAluno;
    }

    // Cacheia o scraper e o boletim pra reusar sem nova requisição
    sessoes.set(matricula, {
      scraper,
      boletim,
      professores,
      criadoEm: Date.now(),
    });
    setTimeout(() => sessoes.delete(matricula), SESSAO_TTL);

    // Gera token
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
      turma: boletim.turma?.turma || aluno.turma || null,
      tipo: "aluno",
      boletim, // retorna já o boletim pronto
    });

    console.log("   ✓ login completo\n");
  } catch (e) {
    console.error("   ✗ erro:", e.message);
    res.status(500).json({
      erro: "Falha ao conectar no SigEduc. Verifique sua conexão.",
      detalhe: e.message,
    });
  }
});

/* ============================================================
   BOLETIM — usa cache ou re-busca
   ============================================================ */
router.get("/boletim", (req, res) => {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  const sessao = sessoes.get(payload.matricula);
  if (sessao && sessao.boletim) {
    return res.json(sessao.boletim);
  }

  // Sessão expirou — precisa logar de novo
  res.status(401).json({
    erro: "Sessão do SigEduc expirou. Faça login novamente.",
  });
});

/* ============================================================
   LOGOUT
   ============================================================ */
router.post("/logout", (req, res) => {
  const token = req.cookies?.token_aluno;
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      sessoes.delete(payload.matricula);
    } catch {}
  }
  res.clearCookie("token_aluno", COOKIE_OPTS);
  res.json({ ok: true });
});

/* ============================================================
   SESSÃO ATUAL
   ============================================================ */
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
