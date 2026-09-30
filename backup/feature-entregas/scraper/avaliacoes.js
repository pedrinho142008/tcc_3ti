import * as cheerio from "cheerio";
const limpar = (t) => (t || "").replace(/\s+/g, " ").trim();
export function parseAvaliacoes(html) {
  const $ = cheerio.load(html);
  const r = { avaliacoes: [] };
  $("table").each((_, t) => {
    const txt = $(t).text().toUpperCase();
    if (!txt.includes("AVALIA") && !txt.includes("DATA")) return;
    $(t).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const l = tds.map((_, td) => limpar($(td).text())).get();
      if (l.some(v => v)) r.avaliacoes.push(l);
    });
  });
  return r;
}
