/**
 * testar-cpf-detalhado.mjs — Mostra EXATAMENTE o que acontece com CPF
 * Uso: node testar-cpf-detalhado.mjs CPF SENHA
 */

import { SigEducClient } from "./server/scraper/client.js";

const cpf = process.argv[2];
const senha = process.argv[3];

if (!cpf || !senha) {
  console.error("❌ Uso: node testar-cpf-detalhado.mjs CPF SENHA");
  process.exit(1);
}

console.log("=".repeat(60));
console.log("🔬 TESTE DETALHADO COM CPF");
console.log("=".repeat(60));
console.log(`CPF:   ${cpf} (${cpf.length} dígitos)`);
console.log(`Senha: ${"*".repeat(senha.length)} (${senha.length} chars)`);
console.log("=".repeat(60) + "\n");

const c = new SigEducClient();
const t0 = Date.now();

try {
  console.log("📋 PASSO 1 — Chamando c.login()\n");
  const ok = await c.login(cpf, senha);

  console.log(`\n📊 Resultado: ${ok ? "✅ TRUE" : "❌ FALSE"}`);
  console.log(`⏱️ Tempo: ${Date.now() - t0}ms`);
  console.log(`📎 Vínculos encontrados: ${c.vinculos?.length || 0}`);

  if (ok) {
    console.log("\n⚠️ ATENÇÃO: c.login() retornou TRUE");
    console.log("   Mas isso NÃO significa que logou de verdade!");
    console.log("   Vamos testar o portal...\n");

    console.log("📋 PASSO 2 — Testando portal\n");
    try {
      await c.escolherVinculoAutomatico();
      const htmlPortal = await c.portal();
      console.log(`📄 Portal: ${htmlPortal.length} bytes`);

      if (htmlPortal.length < 1000) {
        console.log("❌ CONFIRMADO: o portal está VAZIO");
        console.log("   Isso significa que o CPF NÃO logou de verdade");
        console.log("   Só passou pela tela de login");
      } else {
        console.log("✅ Portal tem conteúdo — login REALMENTE funcionou!");
        console.log(`   Primeiros 500 chars:`);
        console.log(htmlPortal.slice(0, 500));
      }
    } catch (e) {
      console.log(`❌ Erro no portal: ${e.message}`);
    }
  } else {
    console.log("\n✅ c.login() retornou FALSE — comportamento correto");
    console.log("   O SigEduc rejeitou o CPF");
  }
} catch (e) {
  console.log(`\n💥 Exceção: ${e.message}`);
  console.log(e.stack);
}

console.log("\n" + "=".repeat(60));
