import { SigEducClient } from "./server/scraper/client.js";
import fs from "node:fs";

const matricula = process.argv[2];
const senha = process.argv[3];
const c = new SigEducClient();

console.log("🔐 Login...");
await c.login(matricula, senha);
await c.escolherVinculoAutomatico();

console.log("\n📊 Buscando boletim...");
const html = await c.boletim();
console.log(`   Tamanho: ${html.length} bytes`);

fs.writeFileSync("boletim-debug.html", html);
console.log("💾 Salvo em: boletim-debug.html");

// Verificações
console.log("\n🔍 Verificações:");
console.log(`   Tem '<table'? ${html.includes("<table")}`);
console.log(`   Tem 'Componentes'? ${html.includes("Componentes") || html.includes("COMPONENTES")}`);
console.log(`   Tem 'Bimestre'? ${html.includes("Bimestre") || html.includes("BIMESTRE")}`);
console.log(`   Tem 'Português'? ${html.includes("Português") || html.includes("PORTUG")}`);
console.log(`   Tem 'Matemática'? ${html.includes("Matem")}`);

const tabelas = (html.match(/<table/g) || []).length;
const linhas = (html.match(/<tr/g) || []).length;
console.log(`\n   Tabelas: ${tabelas}`);
console.log(`   Linhas <tr>: ${linhas}`);

// Salva o texto limpo também
const textoLimpo = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                       .replace(/<style[\s\S]*?<\/style>/gi, "")
                       .replace(/<[^>]+>/g, " ")
                       .replace(/\s+/g, " ")
                       .trim();
fs.writeFileSync("boletim-texto.txt", textoLimpo);
console.log(`\n📄 Texto limpo (primeiros 500 chars):`);
console.log(textoLimpo.slice(0, 500));
