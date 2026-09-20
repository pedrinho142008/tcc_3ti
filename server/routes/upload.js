/**
 * Rota de upload de imagens para o Supabase Storage.
 * Aceita arquivo local (multipart) OU URL externa.
 */

import express from "express";
import multer from "multer";
import { adminClient } from "../supabase.js";
import { middlewareAuth } from "../auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const BUCKET = "imagens";

// Upload de arquivo (foto do dispositivo)
router.post("/upload", middlewareAuth, upload.single("arquivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado" });

    const ext = req.file.originalname.split(".").pop();
    const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await adminClient.storage
      .from(BUCKET)
      .upload(nome, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) return res.status(500).json({ erro: error.message });

    const { data: pub } = adminClient.storage.from(BUCKET).getPublicUrl(nome);

    res.json({ url: pub.publicUrl });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

export default router;
