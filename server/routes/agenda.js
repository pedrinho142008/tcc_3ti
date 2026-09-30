import express from "express";
import { publicClient, adminClient } from "../supabase.js";
import { middlewareAuth } from "../auth.js";
import { middlewareAluno } from "../auth-aluno.js";

const router = express.Router();

router.get("/agenda/:ano/:turno/:tipo", middlewareAluno, async (req, res) => {
  const { ano, turno, tipo } = req.params;

  const { data, error } = await adminClient
    .from("agenda_aulas").select("*")
    .eq("ano", ano).eq("turno", turno).eq("tipo", tipo).eq("ativo", true)
    .order("dia_semana").order("horario");

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

router.get("/agenda", middlewareAuth, async (req, res) => {
  if (req.user.tipo !== "admin") return res.status(403).json({ erro: "Só admin" });

  const { data, error } = await adminClient
    .from("agenda_aulas").select("*").eq("ativo", true)
    .order("ano").order("turno").order("dia_semana").order("horario");

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

router.post("/agenda", middlewareAuth, async (req, res) => {
  if (req.user.tipo !== "admin") return res.status(403).json({ erro: "Só admin" });

  const { ano, turno, tipo, dia_semana, horario, materia, professor, sala } = req.body;

  if (!ano || !turno || !tipo || !dia_semana || !horario || !materia || !professor) {
    return res.status(400).json({ erro: "Campos obrigatórios faltando" });
  }

  const { data, error } = await adminClient
    .from("agenda_aulas")
    .insert([{
      ano, turno, tipo,
      dia_semana: parseInt(dia_semana),
      horario, materia, professor,
      sala: sala || null,
    }])
    .select().single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   PASTE — colar várias aulas
   Formato: dia,horario,materia,professor[,sala]
   ============================================================ */
router.post("/agenda/paste", middlewareAuth, async (req, res) => {
  if (req.user.tipo !== "admin") return res.status(403).json({ erro: "Só admin" });

  const { ano, turno, tipo, texto } = req.body;

  if (!ano || !turno || !tipo || !texto) {
    return res.status(400).json({ erro: "Ano, turno, tipo e texto são obrigatórios" });
  }

  const linhas = texto.split("\n").map((l) => l.trim()).filter((l) => l);
  const aulas = [];

  for (const linha of linhas) {
    const partes = linha.split(",").map((s) => s.trim());
    if (partes.length < 4) continue;

    const dia = parseInt(partes[0]);
    if (dia < 1 || dia > 5) continue;

    aulas.push({
      ano, turno, tipo,
      dia_semana: dia,
      horario: partes[1],
      materia: partes[2],
      professor: partes[3],
      sala: partes[4] || null,
    });
  }

  if (aulas.length === 0) {
    return res.status(400).json({ erro: "Formato: dia,horario,materia,professor[,sala]" });
  }

  await adminClient.from("agenda_aulas").delete()
    .eq("ano", ano).eq("turno", turno).eq("tipo", tipo);

  const { data, error } = await adminClient.from("agenda_aulas").insert(aulas).select();

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true, adicionadas: data.length });
});

router.delete("/agenda/:id", middlewareAuth, async (req, res) => {
  if (req.user.tipo !== "admin") return res.status(403).json({ erro: "Só admin" });

  const { error } = await adminClient.from("agenda_aulas").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
