import * as cheerio from "cheerio";
const limpar = (t) => (t || "").replace(/\s+/g, " ").trim();
export function parseFrequencia(html) {
  const $ = cheerio.load(html);
  const r = { colunas: [], linhas: [] };
  $("table").each((_, t) => {
    const txt = $(t).text().toUpperCase();
    if (!txt.includes("FREQUÊNCIA") && !txt.includes("FALTA")) return;
    $(t).find("thead th").each((_, th) => {
      const v = limpar($(th).text());
      if (v) r.colunas.push(v);
    });
    $(t).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 3) return;
      const l = tds.map((_, td) => limpar($(td).text())).get();
      if (l.some(v => v)) r.linhas.push(l);
    });
  });
  return r;
}
