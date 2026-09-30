import { SigEducClient } from "./client.js";
import { parseBoletim } from "./boletim.js";
import { parseProfessores, parsePerfil } from "./professores.js";
import { parseFrequencia } from "./frequencia.js";
import { parseAvaliacoes } from "./avaliacoes.js";
import { parseHistorico } from "./historico.js";
import { parseCalendario } from "./calendario.js";
import { parseEscolaDigital } from "./escolaDigital.js";

export class SigEducScraper {
  constructor() { this.client = new SigEducClient(); }

  async rasparTudo(matricula, senha, vinculo = 1) {
    console.log(`\n🎓 Scraping: ${matricula}`);
    if (!(await this.client.login(matricula, senha))) return { erro: "Credenciais inválidas" };
    await this.client.escolherVinculo(vinculo);

    console.log("📥 Portal...");
    const hp = await this.client.portal();
    const perfil = parsePerfil(hp);
    const professores = parseProfessores(hp);

    console.log("📊 Boletim...");
    const boletim = parseBoletim(await this.client.boletim());
    for (const d of boletim.disciplinas) {
      const m = professores[d.nome] || {};
      d.professor = m.professor || "—";
      d.horario = m.horario || "—";
    }

    console.log("📅 Frequência...");
    const frequencia = parseFrequencia(await this.client.frequencia());

    console.log("📝 Avaliações...");
    const avaliacoes = parseAvaliacoes(await this.client.avaliacoes());

    console.log("📜 Histórico...");
    const historico = parseHistorico(await this.client.historico());

    console.log("📆 Calendário...");
    const calendario = parseCalendario(await this.client.calendario());

    console.log("🎒 Escola Digital...");
    const escolaDigital = parseEscolaDigital(await this.client.escolaDigital());

    return { perfil, professores, boletim, frequencia, avaliacoes,
             historico, calendario, escolaDigital,
             meta: { matricula, coletadoEm: new Date().toISOString() } };
  }

  async rasparSoBoletim(matricula, senha, vinculo = 1) {
    if (!(await this.client.login(matricula, senha))) return { erro: "Credenciais inválidas" };
    await this.client.escolherVinculo(vinculo);

    const hp = await this.client.portal();
    const perfil = parsePerfil(hp);
    const professores = parseProfessores(hp);
    const boletim = parseBoletim(await this.client.boletim());
    for (const d of boletim.disciplinas) {
      const m = professores[d.nome] || {};
      d.professor = m.professor || "—";
      d.horario = m.horario || "—";
    }
    return { perfil, professores, boletim };
  }

  getHtmlCache() { return Object.fromEntries(this.client.cache); }
}

export { SigEducClient, parseBoletim, parseProfessores, parsePerfil };
