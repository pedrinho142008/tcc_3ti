import * as cheerio from "cheerio";
const limpar = (t) => (t || "").replace(/\s+/g, " ").trim();
export function parseCalendario(html) {
  const $ = cheerio.load(html);
  const r = { eventos: [] };
  $("table").each((_, t) => {
    const txt = $(t).text().toUpperCase();
    if (!txt.includes("CALEND") && !txt.includes("EVENTO") && !txt.includes("DATA")) return;
    $(t).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const l = tds.map((_, td) => limpar($(td).text())).get();
      if (l.some(v => v)) r.eventos.push(l);
    });
  });
  return r;
}
