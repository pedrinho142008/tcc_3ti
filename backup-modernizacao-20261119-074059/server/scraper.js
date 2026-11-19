/**
 * scraper.js
 * Comunicação HTTP com o SigEduc-RN.
 */

import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import iconv from "iconv-lite";

const BASE = "https://sigeduc.rn.gov.br/sigeduc";
const TIMEOUT = 30000;
const MAX_RETRIES = 2;

export class SigEducScraper {
  constructor() {
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        timeout: TIMEOUT,
        maxRedirects: 5,
        responseType: "arraybuffer",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          Origin: "https://sigeduc.rn.gov.br",
        },
      })
    );
  }

  /**
   * Decodifica um Buffer tentando detectar o encoding certo.
   * O SigEduc usa ISO-8859-1, mas às vezes vem UTF-8.
   */
  _text(buffer) {
    try {
      const buf = Buffer.from(buffer);
      const utf8 = buf.toString("utf8");

      // Se tiver caractere de substituição, provavelmente é Latin1
      if (utf8.includes("\uFFFD")) {
        return iconv.decode(buf, "ISO-8859-1");
      }

      return utf8;
    } catch {
      return iconv.decode(Buffer.from(buffer), "ISO-8859-1");
    }
  }

  /** Wrapper de retry */
  async _retry(fn, tentativas = MAX_RETRIES) {
    let ultimoErro;
    for (let i = 0; i < tentativas; i++) {
      try {
        return await fn();
      } catch (e) {
        ultimoErro = e;
        if (i < tentativas - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
    throw ultimoErro;
  }

  /** Extrai o javax.faces.ViewState */
  _extrairViewState(html) {
    const m = html.match(
      /name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/
    );
    return m ? m[1] : "j_id1";
  }

  /** Login no SigEduc */
  async login(matricula, senha) {
    const url = `${BASE}/logar.do?dispatch=logOn`;
    const body = new URLSearchParams({
      urlRedirect: "",
      acao: "",
      acessibilidade: "",
      "user.login": matricula,
      "user.senha": senha,
    });

    const r = await this._retry(() =>
      this.client.post(url, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        validateStatus: () => true,
      })
    );

    const html = this._text(r.data);
    return (
      html.includes("vinculos") ||
      html.includes("Escolha seu V") ||
      html.includes("escolhaVinculo") ||
      (r.status >= 300 && r.status < 400)
    );
  }

  /** Seleciona vínculo */
  async escolherVinculo(vinculo = 1) {
    const url = `${BASE}/escolhaVinculo.do?dispatch=escolher&vinculo=${vinculo}`;
    const r = await this._retry(() =>
      this.client.get(url, { validateStatus: () => true })
    );
    return r.status >= 200 && r.status < 400;
  }

  /** Abre o portal do discente */
  async abrirPortal() {
    const url = `${BASE}/verPortalDiscente.do`;
    const r = await this._retry(() => this.client.get(url));
    return this._text(r.data);
  }

  /** Lista de turmas (com professores) */
  async listarTurmas() {
    const url = `${BASE}/portais/discente/medio/discente_medio.jsf`;
    const r = await this._retry(() => this.client.get(url));
    return this._text(r.data);
  }

  /** Busca o boletim */
  async buscarBoletim() {
    const htmlPortal = await this.listarTurmas();
    const viewState = this._extrairViewState(htmlPortal);

    const url = `${BASE}/portais/discente/medio/discente_medio.jsf`;
    const body = new URLSearchParams({
      "menu:form_menu_discente": "menu:form_menu_discente",
      DOUBLE_CHECK_TOKEN: "",
      id: "1537154",
      jscook_action:
        "menu_form_menu_discente_j_id_jsp_51238765_96_menu:A]#" +
        "{ boletimMedioMBean.iniciarEstudanteBaseComum }",
      "javax.faces.ViewState": viewState,
    });

    const r = await this._retry(() =>
      this.client.post(url, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );

    return this._text(r.data);
  }
}
