/**
 * parser.js — v3 (robusto)
 */

import * as cheerio from "cheerio";

function limpar(txt) {
  return (txt || "").replace(/\s+/g, " ").trim();
}

export function parseBoletim(html) {
  const $ = cheerio.load(html);

  const resultado = {
    aluno: {},
    escola: {},
    turma: {},
    disciplinas: [],
    situacao: {},
    meta: { emitido: "", versao: "3.0.0" },
  };

  resultado.meta.emitido = limpar($(".dataAtual").first().text());

  // ---------- ALUNO / ESCOLA / TURMA ----------
  $("table").each((_, tabela) => {
    const tds = $(tabela).find("td");
    if (tds.length < 4) return;

    tds.each((i, td) => {
      const label = limpar($(td).text()).replace(/:$/, "");
      const valor = limpar($(td).next().text());
      if (!label || !valor) return;

      if (label === "Escola") resultado.escola.nome = valor;
      if (label === "Código INEP") resultado.escola.inep = valor;
      if (label === "DIREC") resultado.escola.direc = valor;
      if (label === "Endereço") resultado.escola.endereco = valor;
      if (label === "Bairro") resultado.escola.bairro = valor;
      if (label === "UF") resultado.escola.uf = valor;
      if (label === "Município") resultado.escola.municipio = valor;

      if (label === "Nome Civil") resultado.aluno.nome = valor;
      if (label === "Matrícula") resultado.aluno.matricula = valor;
      if (label === "Ano") resultado.aluno.ano = valor;
      if (label === "Data de Nascimento") resultado.aluno.dataNascimento = valor;
      if (label === "Naturalidade") resultado.aluno.naturalidade = valor;
      if (label === "Nacionalidade") resultado.aluno.nacionalidade = valor;

      if (label === "Turma") resultado.turma.turma = valor;
      if (label === "Ano/Serie/Bloco") resultado.turma.serie = valor;
      if (label === "Turno") resultado.turma.turno = valor;
      if (label === "Etapa de Ensino") resultado.turma.etapa = valor;
      if (label === "Nº de Chamada") resultado.turma.numeroChamada = valor;
    });
  });

  // ---------- DISCIPLINAS ----------
  $("tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length < 10) return;

    const nome = limpar($(tds[0]).text());
    if (!nome || nome.length > 200) return;

    const nomeUpper = nome.toUpperCase();
    if (
      nomeUpper === "DISCIPLINAS" ||
      nomeUpper === "ANUAL" ||
      nomeUpper.includes("COMPONENTES CURRICULARES") ||
      nomeUpper.includes("SITUAÇÃO NA SÉRIE") ||
      nomeUpper.includes("DADOS DA") ||
      nomeUpper.includes("LEGENDA") ||
      /^\d+([.,]\d+)?$/.test(nome)
    ) {
      return;
    }

    const getNota = (idx) => {
      const td = tds[idx];
      if (!td) return "";
      const span = $(td).find("span.notas, span.nota");
      if (span.length) return limpar(span.first().text());
      return limpar($(td).text());
    };

    let faltas = "";
    for (let i = tds.length - 1; i >= 6; i--) {
      const v = limpar($(tds[i]).text());
      if (/^\d+$/.test(v)) {
        faltas = v;
        break;
      }
    }

    let situacao = "";
    for (let i = tds.length - 1; i >= 6; i--) {
      const v = limpar($(tds[i]).text()).toUpperCase();
      if (/^(MAT|APV|RPV|DF|TRA|PP|NOP|AE|AVE)$/.test(v)) {
        situacao = v;
        break;
      }
    }

    resultado.disciplinas.push({
      nome,
      bim1: getNota(1),
      bim2: getNota(2),
      bim3: getNota(3),
      bim4: getNota(4),
      faltas,
      situacao,
    });
  });

  // ---------- SITUAÇÃO NA SÉRIE ----------
  $("table").each((_, tabela) => {
    const txt = limpar($(tabela).text()).toUpperCase();
    if (!txt.includes("SITUAÇÃO NA SÉRIE")) return;

    $(tabela).find("tr").each((_, tr) => {
      const tds = $(tr).find("td, th");
      const valores = [];
      tds.each((_, el) => {
        const v = limpar($(el).text());
        if (v) valores.push(v);
      });

      if (
        valores.length >= 6 &&
        /^[A-Z]+$/.test(valores[0]) &&
        /^\d+$/.test(valores[1])
      ) {
        resultado.situacao = {
          status: valores[0],
          diasLetivos: valores[1],
          cargaHoraria: valores[2],
          aulasDadas: valores[3],
          faltas: valores[4],
          frequencia: valores[5],
        };
      }
    });
  });

  return resultado;
}

export function parseProfessores(html) {
  const $ = cheerio.load(html);
  const professores = {};

  $("table").each((_, tabela) => {
    const thead = limpar($(tabela).find("thead").text());
    if (!thead.includes("Disciplina") || !thead.includes("Professor")) return;

    $(tabela)
      .find("tbody tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 4) return;

        const disciplina = limpar($(tds[1]).text());
        const horario = limpar($(tds[2]).text());
        const professor = limpar($(tds[3]).text());

        if (disciplina) professores[disciplina] = { professor, horario };
      });
  });

  return professores;
}
