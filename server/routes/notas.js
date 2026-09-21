import express from "express";
import { SigEducScraper } from "../scraper.js";
import { parseBoletim, parseProfessores } from "../parser.js";

const router = express.Router();

// Cache simples de boletins (por matrícula)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

router.get("/", async (req, res) => {
  const { matricula } = req.query;
  if (!matricula) return res.status(400).json({ erro: "Matrícula obrigatória" });

  // Cache hit
  const hit = cache.get(matricula);
  if (hit && Date.now() - hit.t < CACHE_TTL) {
    return res.json(hit.v);
  }

  // Precisa da senha — por enquanto não temos. Retorna vazio.
  return res.json({
    disciplinas: [],
    situacao: {},
    aluno: { matricula },
    aviso: "Boletim não disponível. Integração com SigEduc em desenvolvimento.",
  });
});

export default router;
