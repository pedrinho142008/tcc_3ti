/**
 * index.js — Backend do site escolar E.E.I.M
 */

import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import posts from "./routes/posts.js";
import announcements from "./routes/announcements.js";
import meals from "./routes/meals.js";
import events from "./routes/events.js";
import users from "./routes/users.js";
import uploadRouter from "./routes/upload.js";
import atividadesRouter from "./routes/atividades.js";
import alunoRouter from "./routes/aluno.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("trust proxy", 1);

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

/* ---------- Cache em memória (5s) ---------- */
const cache = new Map();
const CACHE_TTL = 5000;

function cacheMiddleware(req, res, next) {
  if (req.method !== "GET") return next();
  const key = req.originalUrl;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) {
    return res.json(hit.v);
  }
  const originalJson = res.json.bind(res);
  res.json = (v) => {
    if (res.statusCode === 200) cache.set(key, { t: Date.now(), v });
    return originalJson(v);
  };
  next();
}

app.use("/api/", cacheMiddleware);

/* ---------- Rotas da API ---------- */
app.use("/api/posts", posts);
app.use("/api/announcements", announcements);
app.use("/api/meals", meals);
app.use("/api/events", events);
app.use("/api/users", users);
app.use("/api/aluno", alunoRouter);
app.use("/api/atividades", atividadesRouter);
app.use("/api", uploadRouter);

/* ---------- Config ---------- */
app.get("/api/config", (req, res) => {
  res.json({
    portalEstudante: process.env.PORTAL_ESTUDANTE_URL || "/portal-aluno.html",
    escola: {
      nome: "E.E.I.M Escola Estadual Ielmo Marinho",
      endereco: "R. Jose Camilo Bezerra, 257-249, Ielmo Marinho - RN",
      telefone: "(84) 99106-4898",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ erro: "Rota não encontrada" });
  }
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 4000;

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`\n🏫 Site rodando em http://localhost:${PORT}\n`));
}

export default app;
