import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// 🔍 log de requisições de login/boletim
app.use((req, res, next) => {
  if (req.path.includes("/aluno/login") || req.path.includes("/aluno/boletim")) {
    console.log(`→ ${req.method} ${req.originalUrl} | ip=${req.ip}`);
  }
  next();
});

console.log("📦 Carregando rotas...");

const rotas = {};
const errosCarregamento = {};

async function carregar(nome, caminho) {
  try {
    const mod = await import(caminho);
    rotas[nome] = mod.default;
    console.log(`  ✅ ${nome}`);
  } catch (e) {
    console.error(`  ❌ ${nome}: ${e.message}`);
    errosCarregamento[nome] = e.message;
  }
}

await carregar("posts", "./routes/posts.js");
await carregar("announcements", "./routes/announcements.js");
await carregar("meals", "./routes/meals.js");
await carregar("events", "./routes/events.js");
await carregar("users", "./routes/users.js");
await carregar("upload", "./routes/upload.js");
await carregar("atividades", "./routes/atividades.js");
await carregar("aluno", "./routes/aluno.js");
await carregar("alunos", "./routes/alunos.js");
await carregar("cadastro", "./routes/cadastro.js");
await carregar("verificarMatricula", "./routes/verificarMatricula.js");
await carregar("classroom", "./routes/classroom.js");
await carregar("pais", "./routes/pais.js");
await carregar("anotacoes", "./routes/anotacoes.js");
await carregar("alunos-boletim", "./routes/alunos-boletim.js");
await carregar("importar-alunos", "./routes/importar-alunos.js");
await carregar("turmas", "./routes/turmas.js");
await carregar("correcao", "./routes/correcao.js");
await carregar("foto-aluno", "./routes/foto-aluno.js");
await carregar("cadastro-aluno", "./routes/cadastro-aluno.js");
await carregar("dashboard-prof", "./routes/dashboard-prof.js");
await carregar("manutencao", "./routes/manutencao.js");
await carregar("documentos", "./routes/documentos.js");
await carregar("mural", "./routes/mural.js");
await carregar("agenda", "./routes/agenda.js");
await carregar("merenda-stats", "./routes/merenda-stats.js");

console.log("\n📋 Rotas carregadas:");
for (const [nome, mod] of Object.entries(rotas)) {
  console.log(`   ${mod ? "✅" : "❌"} ${nome}`);
}
console.log("");

const cache = new Map();
const CACHE_TTL = 5000;

app.use("/api/", (req, res, next) => {
  if (req.method !== "GET") return next();
  const key = req.originalUrl;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return res.json(hit.v);
  const originalJson = res.json.bind(res);
  res.json = (v) => {
    if (res.statusCode === 200) cache.set(key, { t: Date.now(), v });
    return originalJson(v);
  };
  next();
});

if (rotas.posts) app.use("/api/posts", rotas.posts);
if (rotas.announcements) app.use("/api/announcements", rotas.announcements);
if (rotas.meals) app.use("/api/meals", rotas.meals);
if (rotas.events) app.use("/api/events", rotas.events);
if (rotas.users) app.use("/api/users", rotas.users);
if (rotas.aluno) app.use("/api/aluno", rotas.aluno);
if (rotas.alunos) app.use("/api/alunos", rotas.alunos);
if (rotas["alunos-boletim"]) app.use("/api/alunos", rotas["alunos-boletim"]);
if (rotas["importar-alunos"]) app.use("/api", rotas["importar-alunos"]);
if (rotas.turmas) app.use("/api/turmas", rotas.turmas);
if (rotas.correcao) app.use("/api", rotas.correcao);
if (rotas["foto-aluno"]) app.use("/api", rotas["foto-aluno"]);
if (rotas["cadastro-aluno"]) app.use("/api", rotas["cadastro-aluno"]);
if (rotas["dashboard-prof"]) app.use("/api", rotas["dashboard-prof"]);
if (rotas.manutencao) app.use("/api", rotas.manutencao);
if (rotas.documentos) app.use("/api", rotas.documentos);
if (rotas.mural) app.use("/api", rotas.mural);
if (rotas.agenda) app.use("/api", rotas.agenda);
if (rotas["merenda-stats"]) app.use("/api", rotas["merenda-stats"]);
if (rotas.atividades) app.use("/api/atividades", rotas.atividades);
if (rotas.cadastro) app.use("/api/cadastro", rotas.cadastro);
if (rotas.verificarMatricula) app.use("/api/verificar-matricula", rotas.verificarMatricula);
if (rotas.classroom) app.use("/api/classroom", rotas.classroom);
if (rotas.pais) app.use("/api/pais", rotas.pais);
if (rotas.anotacoes) app.use("/api", rotas.anotacoes);
if (rotas.upload) app.use("/api", rotas.upload);

app.get("/api/config", (req, res) => {
  res.json({
    portalEstudante: "/portal-aluno.html",
    escola: {
      nome: "E.E.I.M Escola Estadual Ielmo Marinho",
      endereco: "R. Jose Camilo Bezerra, 257-249, Ielmo Marinho - RN",
      telefone: "(84) 99106-4898",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    rotas: Object.fromEntries(Object.entries(rotas).map(([k, v]) => [k, !!v])),
    erros: errosCarregamento,
    node: process.version,
    env: process.env.VERCEL === "1" ? "vercel" : "local",
  });
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ erro: "Rota não encontrada" });
  }
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 5000;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`\n🏫 Rodando em http://localhost:${PORT}\n`));
}

export default app;
