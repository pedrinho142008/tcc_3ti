import * as cheerio from "cheerio";
const limpar = (t) => (t || "").replace(/\s+/g, " ").trim();

export function parseBoletim(html) {
  const $ = cheerio.load(html);
  const r = { aluno: {}, escola: {}, turma: {}, disciplinas: [], situacao: {} };

  $("table").each((_, t) => {
    const tds = $(t).find("td");
    if (tds.length < 4) return;
    tds.each((i, td) => {
      const label = limpar($(td).text()).replace(/:$/, "");
      const valor = limpar($(td).next().text());
      if (!label || !valor) return;
      if (label === "Escola") r.escola.nome = valor;
      else if (label === "Código INEP") r.escola.inep = valor;
      else if (label === "DIREC") r.escola.direc = valor;
      else if (label === "Nome Civil") r.aluno.nome = valor;
      else if (label === "Matrícula") r.aluno.matricula = valor;
      else if (label === "Ano") r.aluno.ano = valor;
      else if (label === "Data de Nascimento") r.aluno.dataNascimento = valor;
      else if (label === "Naturalidade") r.aluno.naturalidade = valor;
      else if (label === "Nacionalidade") r.aluno.nacionalidade = valor;
      else if (label === "Turma") r.turma.turma = valor;
      else if (label === "Ano/Serie/Bloco") r.turma.serie = valor;
      else if (label === "Turno") r.turma.turno = valor;
      else if (label === "Nº de Chamada") r.turma.numeroChamada = valor;
    });
  });

  $("table").each((_, t) => {
    if (!$(t).text().toUpperCase().includes("COMPONENTES CURRICULARES")) return;
    $(t).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length !== 11) return;
      const nome = limpar($(tds[0]).text());
      if (!nome || nome.length > 200) return;
      const nu = nome.toUpperCase();
      if (nu.includes("COMPONENTES") || nu.includes("DISCIPLINAS") || nu === "ANUAL") return;
      r.disciplinas.push({
        nome,
        bim1: limpar($(tds[1]).text()), bim2: limpar($(tds[2]).text()),
        bim3: limpar($(tds[3]).text()), bim4: limpar($(tds[4]).text()),
        mediaAnual: limpar($(tds[5]).text()), exameFinal: limpar($(tds[6]).text()),
        avalEspecial: limpar($(tds[7]).text()), mediaFinal: limpar($(tds[8]).text()),
        faltas: limpar($(tds[9]).text()), situacao: limpar($(tds[10]).text()),
      });
    });
  });

  $("table").each((_, t) => {
    if (!$(t).text().toUpperCase().includes("SITUAÇÃO NA SÉRIE")) return;
    $(t).find("tr").each((_, tr) => {
      const vals = [];
      $(tr).find("td, th").each((_, c) => {
        const v = limpar($(c).text());
        if (v) vals.push(v);
      });
      if (vals.length >= 6 && /^[A-Z]+$/.test(vals[0]) && /^\d+$/.test(vals[1])) {
        r.situacao = { status: vals[0], diasLetivos: vals[1], cargaHoraria: vals[2],
                       aulasDadas: vals[3], faltas: vals[4], frequencia: vals[5] };
      }
    });
  });

  return r;
}
