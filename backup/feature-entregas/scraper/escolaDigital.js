import * as cheerio from "cheerio";
const limpar = (t) => (t || "").replace(/\s+/g, " ").trim();
export function parseEscolaDigital(html) {
  const $ = cheerio.load(html);
  const r = { titulo: "", turmas: [], alunos: [] };
  r.titulo = limpar($("h1, h2, .titulo").first().text());
  $("table").each((_, t) => {
    const th = $(t).find("thead, tr").first().text().toUpperCase();
    if (th.includes("ALUNO") || th.includes("NOME") || th.includes("ESTUDANTE")) {
      $(t).find("tbody tr, tr").each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 2) return;
        const l = tds.map((_, td) => limpar($(td).text())).get();
        if (l[0] && !l[0].toUpperCase().includes("NOME"))
          r.alunos.push({ nome: l[0], dados: l.slice(1) });
      });
    }
    if (th.includes("TURMA") || th.includes("DISCIPLINA")) {
      $(t).find("tbody tr, tr").each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 2) return;
        const l = tds.map((_, td) => limpar($(td).text())).get();
        if (l[0]) r.turmas.push({ nome: l[0], dados: l.slice(1) });
      });
    }
  });
  return r;
}
