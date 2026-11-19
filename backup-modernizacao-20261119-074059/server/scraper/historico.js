import * as cheerio from "cheerio";
const limpar = (t) => (t || "").replace(/\s+/g, " ").trim();
export function parseHistorico(html) {
  const $ = cheerio.load(html);
  const r = { materias: [] };
  $("table").each((_, t) => {
    const cab = $(t).find("tr").first().text().toUpperCase();
    if (!cab.includes("DISCIPLINA") && !cab.includes("COMPONENTE")) return;
    $(t).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 3) return;
      const l = tds.map((_, td) => limpar($(td).text())).get();
      if (l[0]) r.materias.push({ disciplina: l[0], dados: l.slice(1) });
    });
  });
  return r;
}
