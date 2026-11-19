import express from "express";
import { adminClient } from "../supabase.js";
import { middlewareAuth, middlewareFuncionario } from "../auth.js";

const router = express.Router();

const TURMAS = [
  "1º Ano A", "1º Ano T.I",
  "2º Ano A", "2º Ano T.I",
  "3º Ano A", "3º Ano T.I",
];

router.get("/lista-disponiveis", (req, res) => res.json(TURMAS));

router.get("/estatisticas", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { data, error } = await adminClient.from("alunos").select("turma");
  if (error) return res.status(500).json({ erro: error.message });

  const contagem = {};
  for (const t of TURMAS) contagem[t] = 0;
  for (const a of data || []) {
    if (a.turma && contagem[a.turma] !== undefined) contagem[a.turma]++;
  }
  res.json(contagem);
});

router.get("/:turma/alunos", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const turma = decodeURIComponent(req.params.turma);
  const { data, error } = await adminClient
    .from("alunos")
    .select("id, matricula, nome, turma, criado_em")
    .eq("turma", turma)
    .order("nome");

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

/* ============================================================
   Smart Paste — aceita formatos:
     1) "matricula, nome"
     2) "matricula - nome"
     3) "matricula\tnome"
     4) "matricula nome"
     5) "nome" sozinho
     6) 3 linhas por aluno: nome\nmatricula\nemail
     7) 2 linhas por aluno: nome\nmatricula
   ============================================================ */
router.post("/:turma/importar-texto", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const turma = decodeURIComponent(req.params.turma);
  const { texto } = req.body;

  if (!texto || typeof texto !== "string") {
    return res.status(400).json({ erro: "Texto obrigatório" });
  }
  if (!TURMAS.includes(turma)) {
    return res.status(400).json({ erro: `Turma inválida: ${turma}` });
  }

  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^matr[íi]cula/i.test(l));

  if (linhas.length === 0) {
    return res.status(400).json({ erro: "Nenhuma linha válida" });
  }

  const alunos = [];
  let contadorTemp = 0;
  let i = 0;

  // Detecta formato: 1 linha, 2 linhas ou 3 linhas por aluno
  while (i < linhas.length) {
    const l1 = linhas[i];
    const l2 = linhas[i + 1];
    const l3 = linhas[i + 2];

    let matricula = null;
    let nome = null;

    // ===== FORMATO 3 LINHAS: nome \n matricula \n email =====
    if (
      l1 && l2 && l3 &&
      !/^\d+$/.test(l1) &&           // l1 não é número
      /^\d{6,}$/.test(l2) &&          // l2 é matrícula
      /@|^desconhecido$/i.test(l3)    // l3 é email ou "Desconhecido"
    ) {
      nome = l1;
      matricula = l2;
      i += 3;
    }
    // ===== FORMATO 2 LINHAS: nome \n matricula =====
    else if (
      l1 && l2 &&
      !/^\d+$/.test(l1) &&
      /^\d{6,}$/.test(l2) &&
      !/^\d{6,}$/.test(l1)
    ) {
      nome = l1;
      matricula = l2;
      i += 2;
    }
    // ===== FORMATO 1 LINHA =====
    else {
      const linha = l1;
      i++;

      // "matricula, nome" ou "nome, matricula"
      if (linha.includes(",")) {
        const [a, b] = linha.split(",").map((s) => s.trim());
        if (/^\d{4,}$/.test(a)) { matricula = a; nome = b; }
        else if (/^\d{4,}$/.test(b)) { matricula = b; nome = a; }
      }

      // "matricula - nome"
      if (!matricula && /\s[-–]\s/.test(linha)) {
        const [a, b] = linha.split(/\s[-–]\s/).map((s) => s.trim());
        if (/^\d{4,}$/.test(a)) { matricula = a; nome = b; }
        else if (/^\d{4,}$/.test(b)) { matricula = b; nome = a; }
      }

      // "matricula\tnome"
      if (!matricula && linha.includes("\t")) {
        const partes = linha.split("\t").map((s) => s.trim());
        if (/^\d{4,}$/.test(partes[0])) {
          matricula = partes[0];
          nome = partes.slice(1).join(" ");
        }
      }

      // "matricula nome"
      if (!matricula) {
        const m = linha.match(/^(\d{4,})\s+(.+)$/);
        if (m) { matricula = m[1]; nome = m[2].trim(); }
      }

      // Só nome
      if (!matricula && linha.length > 2 && !/^\d+$/.test(linha)) {
        contadorTemp++;
        matricula = `TEMP-${turma.replace(/\s/g, "")}-${String(contadorTemp).padStart(3, "0")}`;
        nome = linha;
      }
    }

    if (matricula && nome && nome.length > 1) {
      alunos.push({
        matricula,
        nome: nome.toUpperCase(),
        turma,
        // NÃO envia 'ativo' — pode não existir na tabela
      });
    }
  }

  if (alunos.length === 0) {
    return res.status(400).json({ erro: "Não foi possível interpretar nenhuma linha" });
  }

  const { data, error } = await adminClient
    .from("alunos")
    .upsert(alunos, { onConflict: "matricula" })
    .select();

  if (error) {
    console.error("Erro upsert:", error);
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    ok: true,
    importados: data.length,
    alunos: data,
  });
});

router.post("/:turma/cadastrar", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const turma = decodeURIComponent(req.params.turma);
  const { matricula, nome } = req.body;

  if (!matricula || !nome) {
    return res.status(400).json({ erro: "Matrícula e nome obrigatórios" });
  }
  if (!TURMAS.includes(turma)) {
    return res.status(400).json({ erro: `Turma inválida: ${turma}` });
  }

  const { data, error } = await adminClient
    .from("alunos")
    .upsert(
      [{ matricula: String(matricula).trim(), nome: nome.trim().toUpperCase(), turma }],
      { onConflict: "matricula" }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

router.delete("/alunos/:id", middlewareAuth, middlewareFuncionario, async (req, res) => {
  const { error } = await adminClient.from("alunos").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
