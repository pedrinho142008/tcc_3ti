import express from "express";
import multer from "multer";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ============================================================
   IMPORTAR CSV com alunos (matrícula, nome, turma)
   Formato aceito:
     matricula,nome,turma
     202430395866,PEDRO VICTOR,3º Ano T.I
   ============================================================ */
router.post("/alunos/importar", middlewareAuth, middlewareFuncionario,
  upload.single("arquivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo" });

    const texto = req.file.buffer.toString("utf-8");
    const linhas = texto.split("\n").filter((l) => l.trim());
    if (linhas.length < 2) return res.status(400).json({ erro: "Arquivo vazio" });

    const cabecalho = linhas[0].split(",").map((s) => s.trim().toLowerCase());
    const idxMat = cabecalho.indexOf("matricula");
    const idxNome = cabecalho.indexOf("nome");
    const idxTurma = cabecalho.indexOf("turma");

    if (idxMat === -1 || idxNome === -1) {
      return res.status(400).json({
        erro: "CSV precisa ter colunas: matricula, nome (e opcionalmente turma)",
      });
    }

    const alunos = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(",").map((s) => s.trim());
      if (!cols[idxMat] || !cols[idxNome]) continue;
      alunos.push({
        matricula: cols[idxMat],
        nome: cols[idxNome],
        turma: idxTurma !== -1 ? cols[idxTurma] : null,
        ativo: true,
      });
    }

    if (alunos.length === 0) {
      return res.status(400).json({ erro: "Nenhum aluno válido no arquivo" });
    }

    // Upsert (atualiza se já existir, insere se não)
    const { data, error } = await adminClient
      .from("alunos")
      .upsert(alunos, { onConflict: "matricula" })
      .select();

    if (error) return res.status(500).json({ erro: error.message });

    res.json({
      ok: true,
      importados: data.length,
      total: alunos.length,
      alunos: data,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   CADASTRAR ALUNO MANUALMENTE (um por um)
   ============================================================ */
router.post("/alunos/cadastrar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { matricula, nome, turma } = req.body;
  if (!matricula || !nome) {
    return res.status(400).json({ erro: "Matrícula e nome obrigatórios" });
  }

  const { data, error } = await adminClient
    .from("alunos")
    .upsert([{ matricula, nome, turma: turma || null, ativo: true }],
      { onConflict: "matricula" })
    .select().single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

export default router;
