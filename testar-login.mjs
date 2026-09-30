/**
 * testar-login.mjs — Testa quais formatos de login o SigEduc aceita
 * Uso: node testar-login.mjs
 */

import { SigEducClient } from "./server/scraper/client.js";

// Troque por dados reais (com senha correta)
const TESTES = [
  { label: "Matrícula", valor: "202430378140", senha: "202430378140" },
  { label: "CPF",       valor: "16518567457",  senha: "165" },
  { label: "Email",     valor: "pedro@email.com", senha: "202430378140" },
];

async function testar(tipo, valor, senha) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 Testando ${tipo}: ${valor}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const c = new SigEducClient();
  const t0 = Date.now();

  try {
    const ok = await c.login(valor, senha);
    const tempo = Date.now() - t0;

    if (ok) {
      console.log(`✅ ${tipo} FUNCIONA (${tempo}ms)`);
      console.log(`   Vínculos: ${c.vinculos?.length || 0}`);
    } else {
      console.log(`❌ ${tipo} NÃO FUNCIONA (${tempo}ms)`);
    }
  } catch (e) {
    console.log(`💥 ${tipo} ERRO: ${e.message}`);
  }
}

(async () => {
  console.log("🔍 Testando formatos de login no SigEduc\n");

  for (const t of TESTES) {
    await testar(t.label, t.valor, t.senha);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Conclusão");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Baseado nos testes acima, ajuste o frontend");
  console.log("pra aceitar apenas os formatos que funcionam.");
})();
