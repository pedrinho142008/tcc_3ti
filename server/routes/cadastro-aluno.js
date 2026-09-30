import express from "express";
import { adminClient } from "../supabase.js";

const router = express.Router();

const SIGEDUC_BASE = "https://sigeduc.rn.gov.br/sigeduc";
const PRIMEIRO_ACESSO_URL = `${SIGEDUC_BASE}/public/primeiro_acesso/primeiro_acesso.jsf`;

/* ============================================================
   Utilitários
   ============================================================ */

// Mascara CPF: 70800745418 → 708.007.454-18
function mascararCPF(cpf) {
  const nums = String(cpf).replace(/\D/g, "");
  if (nums.length !== 11) return null;
  return nums.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

// Formata data: 2008-05-06 → 06/05/2008
function formatarData(data) {
  if (!data) return null;
  // Se já está no formato brasileiro, retorna
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data;
  // Se é ISO (YYYY-MM-DD), converte
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return null;
}

// Extrai ViewState do HTML
function extrairViewState(html) {
  const m = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
  return m ? m[1] : "j_id1";
}

// Detecta se é CPF ou matrícula
function detectarTipoLogin(login) {
  const nums = String(login).replace(/\D/g, "");
  if (nums.length === 11) return "cpf";
  if (nums.length >= 6) return "matricula";
  return null;
}

/* ============================================================
   PRIMEIRO ACESSO — Faz requisição real ao SigEduc
   ============================================================ */
router.post("/aluno/primeiro-acesso", async (req, res) => {
  const { login, data_nascimento, email } = req.body;

  if (!login || !data_nascimento || !email) {
    return res.status(400).json({
      erro: "Login, data de nascimento e e-mail são obrigatórios",
    });
  }

  const tipoLogin = detectarTipoLogin(login);
  if (!tipoLogin) {
    return res.status(400).json({ erro: "Login inválido (CPF ou matrícula)" });
  }

  // Formata o login pro SigEduc
  let loginFormatado;
  if (tipoLogin === "cpf") {
    loginFormatado = mascararCPF(login);
    if (!loginFormatado) {
      return res.status(400).json({ erro: "CPF inválido (precisa ter 11 dígitos)" });
    }
  } else {
    loginFormatado = String(login).replace(/\D/g, "");
  }

  const dataFormatada = formatarData(data_nascimento);
  if (!dataFormatada) {
    return res.status(400).json({ erro: "Data inválida" });
  }

  if (!email.includes("@")) {
    return res.status(400).json({ erro: "E-mail inválido" });
  }

  console.log(`\n🔑 [PRIMEIRO ACESSO]`);
  console.log(`   Login: ${loginFormatado} (${tipoLogin})`);
  console.log(`   Data:  ${dataFormatada}`);
  console.log(`   Email: ${email}`);

  try {
    // 1. Salva pedido local (histórico)
    const { data: pedido, error: errPedido } = await adminClient
      .from("pedidos_aluno")
      .insert([{
        login: loginFormatado,
        tipo_login: tipoLogin,
        data_nascimento,
        email: email.toLowerCase(),
        status: "pendente",
        origem: "site_eeim",
      }])
      .select()
      .single();

    if (errPedido) {
      console.warn(`   ⚠ Erro ao salvar pedido: ${errPedido.message}`);
    }

    // 2. Faz o GET inicial pra pegar o JSESSIONID + ViewState
    console.log(`   → Buscando página inicial do primeiro acesso...`);
    const cookieJar = new Map();

    const getHeaders = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    const rGet = await fetch(PRIMEIRO_ACESSO_URL, { headers: getHeaders, redirect: "manual" });

    // Salva cookies
    const setCookies = rGet.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }

    const htmlGet = await rGet.text();
    const viewState = extrairViewState(htmlGet);
    console.log(`   ✓ GET OK — ViewState: ${viewState.slice(0, 30)}...`);

    // 3. Monta o body EXATAMENTE como o SigEduc espera
    const body = new URLSearchParams({
      "formPrimeiroAcesso": "formPrimeiroAcesso",
      "DOUBLE_CHECK_TOKEN": "",
      "formPrimeiroAcesso:inputLogin": loginFormatado,
      "formPrimeiroAcesso:inputNascimento": dataFormatada,
      "formPrimeiroAcesso:inputEmailInstitucional": email.toLowerCase(),
      "formPrimeiroAcesso:submit-form": "Validar Dados",
      "javax.faces.ViewState": viewState,
    }).toString();

    // 4. Monta os cookies
    const cookieHeader = Array.from(cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    // 5. Faz o POST
    console.log(`   → Enviando validação...`);
    const rPost = await fetch(PRIMEIRO_ACESSO_URL, {
      method: "POST",
      headers: {
        ...getHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://sigeduc.rn.gov.br",
        "Referer": PRIMEIRO_ACESSO_URL,
        "Cookie": cookieHeader,
      },
      body,
      redirect: "manual",
    });

    const htmlPost = await rPost.text();
    console.log(`   ✓ POST OK — status ${rPost.status} — ${htmlPost.length} bytes`);

    // 6. Analisa a resposta
    const textoLimpo = htmlPost
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Procura mensagens de erro/sucesso
    let sucesso = false;
    let mensagem = "";
    let instrucao = "";

    const erros = [
      /CPF\s+inv[áa]lido/i,
      /matr[íi]cula\s+inv[áa]lida/i,
      /data\s+de\s+nascimento\s+inv[áa]lida/i,
      /e-?mail\s+inv[áa]lido/i,
      /dados?\s+n[ãa]o\s+encontrados?/i,
      /n[ãa]o\s+foi\s+poss[íi]vel/i,
      /erro/i,
    ];

    const sucessos = [
      /token\s+(foi\s+)?enviado/i,
      /verifique\s+seu\s+e-?mail/i,
      /e-?mail\s+enviado/i,
      /acesso\s+liberado/i,
      /dados\s+validados/i,
    ];

    for (const regex of sucessos) {
      if (regex.test(textoLimpo)) {
        sucesso = true;
        mensagem = "Dados validados com sucesso!";
        instrucao = "Verifique seu e-mail institucional. O token de acesso será enviado em alguns minutos.";
        break;
      }
    }

    if (!sucesso) {
      for (const regex of erros) {
        const match = textoLimpo.match(regex);
        if (match) {
          mensagem = "Não foi possível validar os dados.";
          instrucao = "Verifique se os dados estão corretos. Se persistir, entre em contato com a escola.";
          // Tenta extrair mensagem mais específica
          const idx = textoLimpo.indexOf(match[0]);
          if (idx > 0) {
            const trecho = textoLimpo.slice(Math.max(0, idx - 100), idx + 200);
            console.log(`   ⚠ Erro detectado: ${trecho}`);
          }
          break;
        }
      }
    }

    // Se nem sucesso nem erro específico, assume sucesso (SigEduc não retorna erro claro)
    if (!mensagem) {
      sucesso = true;
      mensagem = "Pedido enviado para o SigEduc.";
      instrucao = "Aguarde o token de acesso no e-mail institucional informado. Se não receber em 24h, entre em contato com a escola.";
    }

    // 7. Atualiza o pedido no Supabase
    if (pedido?.id) {
      await adminClient
        .from("pedidos_aluno")
        .update({
          status: sucesso ? "token_enviado" : "pendente",
          resposta_sigeduc: textoLimpo.slice(0, 1000),
        })
        .eq("id", pedido.id)
        .then(() => {})
        .catch(() => {});
    }

    res.json({
      ok: sucesso,
      mensagem,
      instrucao,
      protocolo: pedido?.id,
    });
  } catch (e) {
    console.error(`   ✗ Erro: ${e.message}`);
    res.status(500).json({
      erro: "Não foi possível enviar para o SigEduc. Tente novamente.",
      detalhe: e.message,
    });
  }
});

/* ============================================================
   Verificar status do pedido
   ============================================================ */
router.get("/aluno/primeiro-acesso/status", async (req, res) => {
  const { login } = req.query;
  if (!login) return res.status(400).json({ erro: "Login obrigatório" });

  const { data } = await adminClient
    .from("pedidos_aluno")
    .select("id, status, criado_em")
    .eq("login", login)
    .maybeSingle();

  if (!data) return res.json({ existe: false });

  res.json({
    existe: true,
    status: data.status,
    criado_em: data.criado_em,
  });
});

export default router;
