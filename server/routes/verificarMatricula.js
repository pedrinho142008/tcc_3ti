import express from "express";
import { SigEducClient } from "../scraper/client.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { matricula } = req.body;
  if (!matricula) return res.status(400).json({ erro: "Matrícula obrigatória" });

  try {
    const c = new SigEducClient();
    const url = "https://sigeduc.rn.gov.br/sigeduc/logar.do?dispatch=logOn";

    const body = new URLSearchParams({
      urlRedirect: "", acao: "", acessibilidade: "",
      "user.login": matricula,
      "user.senha": "teste123invalido",
    });

    const r = await c._post(url, body.toString());
    const html = c._text(r.data);

    const naoExiste =
      html.toLowerCase().includes("usuário não") ||
      html.toLowerCase().includes("usuario nao") ||
      html.toLowerCase().includes("não encontrado") ||
      html.toLowerCase().includes("login inválido") ||
      html.toLowerCase().includes("login invalido");

    const existe = !naoExiste;

    res.json({
      existe,
      matricula,
      sugestao: existe
        ? "Matrícula encontrada! Faça login no SigEduc."
        : "Matrícula não encontrada. Faça seu cadastro no SigEduc.",
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

export default router;
