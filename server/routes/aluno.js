import express from "express";
import jwt from "jsonwebtoken";
import { adminClient } from "../supabase.js";
import { SigEducClient } from "../scraper/client.js";
import { parseBoletim } from "../scraper/boletim.js";
import { parsePerfil, parseProfessores } from "../scraper/professores.js";

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

const sessoes = new Map();
const SESSAO_TTL = 15 * 60 * 1000;

/* ============================================================
   LOGIN DO ALUNO
   ============================================================ */
router.post("/login", async (req, res) => {
  const { matricula, senha } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  console.log(`\n🎓 [ALUNO LOGIN] matrícula=${matricula}`);

  try {
    const c = new SigEducClient();

    console.log("   → autenticando no SigEduc...");
    const ok = await c.login(matricula, senha);
    if (!ok) {
      return res.status(401).json({ erro: "Matrícula ou senha incorretos" });
    }

    console.log("   → escolhendo vínculo automaticamente...");
    await c.escolherVinculoAutomatico();

    console.log("   → abrindo portal...");
    const htmlPortal = await c.portal();

    if (htmlPortal.length < 1000) {
      console.warn("   ⚠ portal muito pequeno — sessão expirou");
      return res.status(401).json({
        erro: "Não foi possível abrir o portal. Verifique sua matrícula e senha.",
      });
    }

    const perfil = parsePerfil(htmlPortal);
    const professores = parseProfessores(htmlPortal);
    console.log(`   → portal: ${htmlPortal.length} bytes | ${Object.keys(professores).length} professores`);

    console.log("   → buscando boletim...");
    const htmlBoletim = await c.boletim();
    const boletim = parseBoletim(htmlBoletim);
    console.log(`   → boletim: ${htmlBoletim.length} bytes | ${boletim.disciplinas.length} disciplinas`);

    // Mescla professores nas disciplinas
    for (const d of boletim.disciplinas) {
      const meta = professores[d.nome] || {};
      d.professor = meta.professor || "—";
      d.horario = meta.horario || "—";
    }

    const nomeAluno = perfil.nome || boletim.aluno?.nome || `Aluno ${matricula}`;
    console.log(`   → nome: ${nomeAluno}`);

    // Salva/atualiza no Supabase (não bloqueia se falhar)
    let alunoId = null;
    try {
      const { data: existente } = await adminClient
        .from("alunos")
        .select("*")
        .eq("matricula", matricula)
        .maybeSingle();

      if (existente) {
        alunoId = existente.id;
        if (existente.nome !== nomeAluno) {
          await adminClient
            .from("alunos")
            .update({ nome: nomeAluno, turma: boletim.turma?.turma })
            .eq("id", existente.id);
        }
      } else {
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
        alunoId = novo?.id || null;
      }
    } catch (e) {
      console.warn("   ⚠ Supabase offline:", e.message);
    }

    // Guarda sessão em memória
    sessoes.set(matricula, {
      boletim,
      perfil,
      professores,
      criadoEm: Date.now(),
    });
    setTimeout(() => sessoes.delete(matricula), SESSAO_TTL);

    // Gera token JWT
    const token = jwt.sign(
      {
        id: alunoId || matricula,
        matricula,
        nome: nomeAluno,
        tipo: "aluno",
      },
      SECRET,
      { expiresIn: "8h" }
    );

    res.cookie("token_aluno", token, COOKIE_OPTS);
    res.json({
      id: alunoId || matricula,
      matricula,
      nome: nomeAluno,
      turma: boletim.turma?.turma || null,
      tipo: "aluno",
      perfil,
      boletim,
    });

    console.log("   ✓ login completo\n");
  } catch (e) {
    console.error("   ✗ erro:", e.message);
    console.error(e.stack);
    res.status(500).json({
      erro: "Falha ao conectar no SigEduc. Tente novamente.",
      detalhe: e.message,
    });
  }
});

/* ============================================================
   BOLETIM (cache em memória)
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
  if (sessao?.boletim) return res.json(sessao.boletim);

  res.status(401).json({
    erro: "Sessão do SigEduc expirou. Faça login novamente.",
  });
});

/* ============================================================
   PERFIL (cache em memória)
   ============================================================ */
router.get("/perfil", (req, res) => {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  const sessao = sessoes.get(payload.matricula);
  if (sessao?.perfil) return res.json(sessao.perfil);

  res.status(404).json({ erro: "Perfil não encontrado" });
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
  res.clearCookie("token_aluno", { path: "/" });
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
