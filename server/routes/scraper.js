import express from "express";
import { SigEducScraper } from "../scraper/index.js";

const router = express.Router();

/**
 * POST /api/scraper/boletim
 * Body: { matricula, senha, vinculo }
 */
router.post("/boletim", async (req, res) => {
  const { matricula, senha, vinculo = 1 } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  try {
    const scraper = new SigEducScraper();
    const dados = await scraper.rasparSoBoletim(matricula, senha, vinculo);
    if (dados.erro) return res.status(401).json(dados);
    res.json(dados);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Falha ao raspar", detalhe: e.message });
  }
});

/**
 * POST /api/scraper/tudo
 */
router.post("/tudo", async (req, res) => {
  const { matricula, senha, vinculo = 1 } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  try {
    const scraper = new SigEducScraper();
    const dados = await scraper.rasparTudo(matricula, senha, vinculo);
    if (dados.erro) return res.status(401).json(dados);
    res.json(dados);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Falha ao raspar", detalhe: e.message });
  }
});

/**
 * POST /api/scraper/debug
 */
router.post("/debug", async (req, res) => {
  const { matricula, senha, vinculo = 1 } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ erro: "Matrícula e senha obrigatórios" });
  }

  try {
    const scraper = new SigEducScraper();
    const dados = await scraper.rasparTudo(matricula, senha, vinculo);
    res.json({
      dados,
      htmlCache: scraper.getHtmlCache(),
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

export default router;
