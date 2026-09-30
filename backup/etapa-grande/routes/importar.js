import express from "express";
import * as cheerio from "cheerio";

const router = express.Router();

const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const UA_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/* ============================================================
   Extrai o shortcode (ID) do post a partir da URL
   Ex: https://www.instagram.com/p/CXYZ123/ → "CXYZ123"
   ============================================================ */
function extrairShortcode(url) {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/* ============================================================
   Tenta a API interna do Instagram (não oficial)
   Retorna dados estruturados, incluindo TODAS as imagens do carrossel
   ============================================================ */
async function tentarApiInterna(shortcode) {
  try {
    // Endpoint GraphQL público do Instagram
    const url = `https://www.instagram.com/api/v1/media/${shortcode}/info/`;

    const r = await fetch(url, {
      headers: {
        "User-Agent": UA_MOBILE,
        "Accept": "*/*",
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if (!r.ok) throw new Error(`API interna: ${r.status}`);

    const data = await r.json();

    // Estrutura: data.items[0]
    const item = data?.items?.[0];
    if (!item) throw new Error("Estrutura inesperada");

    // Legenda
    const legenda = item.caption?.text || "";

    // Autor
    const autor = item.user?.username || item.owner?.username || "";

    // Imagens — se for carrossel, pega todas
    const imagens = [];

    if (item.carousel_media && Array.isArray(item.carousel_media)) {
      // Carrossel — cada mídia tem image_versions2.candidates
      for (const media of item.carousel_media) {
        const candidatos = media.image_versions2?.candidates || [];
        if (candidatos.length > 0) {
          // Pega o de MAIOR resolução
          const maior = candidatos.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
          if (maior?.url) imagens.push(maior.url);
        }
      }
    } else {
      // Post único
      const candidatos = item.image_versions2?.candidates || [];
      if (candidatos.length > 0) {
        const maior = candidatos.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
        if (maior?.url) imagens.push(maior.url);
      }
    }

    // Fallback: display_uri
    if (imagens.length === 0 && item.display_uri) {
      imagens.push(item.display_uri);
    }

    console.log(`   ✓ API interna: ${imagens.length} imagens`);
    return { ok: true, legenda, autor, imagens };
  } catch (e) {
    console.log(`   ⚠ API interna falhou: ${e.message}`);
    return { ok: false, erro: e.message, imagens: [] };
  }
}

/* ============================================================
   Deduplicação de imagens
   ============================================================ */
function extrairIdImagem(url) {
  try {
    const semQuery = url.split("?")[0];
    const partes = semQuery.split("/");
    const arquivo = partes[partes.length - 1];

    return arquivo
      .replace(/\.(jpg|jpeg|png|webp|heic)$/i, "")
      .replace(/_\d+_\d+_n$/, "")
      .replace(/_\d+_n$/, "")
      .replace(/_n$/, "")
      .replace(/_\d+$/, "") || arquivo;
  } catch {
    return url;
  }
}

function pontuarResolucao(url) {
  const m = url.match(/_(\d+)_(\d+)_/);
  if (m) return parseInt(m[1]) * parseInt(m[2]);
  return 99999999;
}

function ehThumbnailRuim(url) {
  if (!url) return true;
  return (
    url.includes("/e35/") ||
    url.includes("/s100x100/") ||
    url.includes("s150x150") ||
    url.includes("s320x320") ||
    url.includes("rsrc.php")
  );
}

function deduplicarImagens(urls) {
  const porId = new Map();
  for (const url of urls) {
    if (!url || !url.startsWith("http")) continue;
    if (url.includes("data:image")) continue;
    if (url.includes("static.cdninstagram.com")) continue;
    if (/\.(svg|gif)($|\?)/i.test(url)) continue;
    if (ehThumbnailRuim(url)) continue;

    const id = extrairIdImagem(url);
    const pontuacao = pontuarResolucao(url);

    const existente = porId.get(id);
    if (!existente || pontuacao > existente.pontuacao) {
      porId.set(id, { url, pontuacao });
    }
  }
  return Array.from(porId.values())
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .map((v) => v.url);
}

/* ============================================================
   Scraping do HTML (fallback)
   ============================================================ */
function extrairImagensDoHtml(html) {
  const urls = [];
  const $ = cheerio.load(html);

  const rxDisplay = /"display_url":"(https:[^"]+)"/g;
  let m;
  while ((m = rxDisplay.exec(html)) !== null) {
    urls.push(m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
  }

  const rxImgV2 = /"url":"(https:\\\/\\\/[^"]+\.(?:jpg|png|webp))"/g;
  while ((m = rxImgV2.exec(html)) !== null) {
    urls.push(m[1].replace(/\\\//g, "/").replace(/\\u0026/g, "&"));
  }

  const rxThumb = /"thumbnail_src":"(https:[^"]+)"/g;
  while ((m = rxThumb.exec(html)) !== null) {
    urls.push(m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
  }

  $('meta[property="og:image"]').each((_, el) => {
    const url = $(el).attr("content");
    if (url) urls.push(url);
  });

  return deduplicarImagens(urls).slice(0, 15);
}

async function tentarScraping(url) {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA_MOBILE,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if (!r.ok) throw new Error(`HTML retornou ${r.status}`);
    const html = await r.text();
    const imagens = extrairImagensDoHtml(html);
    const $ = cheerio.load(html);

    const legenda =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";

    return { ok: true, legenda, imagens };
  } catch (e) {
    console.log(`   ⚠ Scraping falhou: ${e.message}`);
    return { ok: false, erro: e.message, imagens: [] };
  }
}

/* ============================================================
   ROTA PRINCIPAL
   ============================================================ */
router.post("/instagram", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ erro: "URL obrigatória" });

  if (!/instagram\.com\/(p|reel|tv)\//i.test(url)) {
    return res.status(400).json({
      erro: "URL inválida. Use links instagram.com/p/... ou instagram.com/reel/...",
    });
  }

  console.log(`\n📷 [IMPORT] ${url}`);

  const shortcode = extrairShortcode(url);
  console.log(`   → shortcode: ${shortcode}`);

  // Estratégia em camadas:
  // 1. API interna (retorna todas as imagens do carrossel)
  // 2. Scraping HTML (fallback)
  let legenda = "";
  let autor = "";
  let imagens = [];

  if (shortcode) {
    const api = await tentarApiInterna(shortcode);
    if (api.ok) {
      legenda = api.legenda;
      autor = api.autor;
      imagens = api.imagens;
    }
  }

  // Se a API interna falhou, tenta scraping
  if (imagens.length === 0) {
    const scraping = await tentarScraping(url);
    if (scraping.ok) {
      if (!legenda) legenda = scraping.legenda;
      imagens = scraping.imagens;
    }
  }

  console.log(`   → legenda: ${legenda.slice(0, 60)}...`);
  console.log(`   → autor: ${autor}`);
  console.log(`   → imagens: ${imagens.length}`);

  // IMPORTANTE: não preenche título automaticamente
  // O admin digita o título manualmente

  if (imagens.length === 0 && !legenda) {
    return res.json({
      sucesso: false,
      url_original: url,
      erro: "Não conseguimos extrair. Preencha manualmente abaixo.",
      legenda: "",
      imagens: [],
    });
  }

  res.json({
    sucesso: true,
    legenda,
    autor,
    url_original: url,
    imagens: imagens.slice(0, 10),
    aviso:
      imagens.length === 1
        ? "Encontramos apenas 1 imagem. Se o post tiver carrossel, adicione as demais manualmente."
        : imagens.length === 0
        ? "Não encontramos imagens. Adicione manualmente."
        : "",
  });
});

router.post("/extrair", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ erro: "URL obrigatória" });

  try {
    const r = await fetch(url, { headers: { "User-Agent": UA_DESKTOP } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const html = await r.text();
    const $ = cheerio.load(html);

    res.json({
      sucesso: true,
      titulo: $('meta[property="og:title"]').attr("content") || $("title").text() || "",
      descricao: $('meta[property="og:description"]').attr("content") || "",
      imagem: $('meta[property="og:image"]').attr("content") || "",
      url_original: url,
    });
  } catch (e) {
    res.json({ sucesso: false, erro: e.message });
  }
});

export default router;
