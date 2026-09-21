import * as cheerio from "cheerio";
const limpar = (t) => (t || "").replace(/\s+/g, " ").trim();

export function parseProfessores(html) {
  const $ = cheerio.load(html);
  const p = {};
  $("table").each((_, t) => {
    const thead = limpar($(t).find("thead").text());
    if (!thead.includes("Disciplina") || !thead.includes("Professor")) return;
    $(t).find("tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 4) return;
      const d = limpar($(tds[1]).text());
      const h = limpar($(tds[2]).text());
      const prof = limpar($(tds[3]).text());
      if (d) p[d] = { professor: prof, horario: h };
    });
  });
  return p;
}

export function parsePerfil(html) {
  const $ = cheerio.load(html);
  const p = {};
  $("table").each((_, t) => {
    const txt = $(t).text();
    if (!txt.includes("Dados do Estudante") && !txt.includes("Matrícula:")) return;
    $(t).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const l = limpar($(tds[0]).text()).replace(/:$/, "");
        const v = limpar($(tds[1]).text());
        if (l && v) p[l.toLowerCase().replace(/ /g, "_")] = v;
      }
    });
  });
  const nome = $(".nome small b, .info-docente .nome b").first().text();
  if (nome) p.nome = limpar(nome);
  const foto = $(".foto img").attr("src");
  if (foto) p.foto_url = foto;
  return p;
}
