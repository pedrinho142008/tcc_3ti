import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import iconv from "iconv-lite";

const BASE = "https://sigeduc.rn.gov.br/sigeduc";
const TIMEOUT = 60000;

export class SigEducClient {
  constructor() {
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        timeout: TIMEOUT,
        maxRedirects: 0,
        responseType: "arraybuffer",
        validateStatus: () => true,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Origin": "https://sigeduc.rn.gov.br",
        },
      })
    );
    this.cache = new Map();
    this.vinculoAtivo = null;
  }

  _text(buffer) {
    try {
      const buf = Buffer.from(buffer);
      const utf8 = buf.toString("utf8");
      if (utf8.includes("\uFFFD")) return iconv.decode(buf, "ISO-8859-1");
      return utf8;
    } catch {
      return iconv.decode(Buffer.from(buffer), "ISO-8859-1");
    }
  }

  _viewState(html) {
    const m = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
    return m ? m[1] : "j_id1";
  }

  _cache(k, h) { this.cache.set(k, h); return h; }

  async _get(url) {
    let atual = url;
    for (let i = 0; i < 6; i++) {
      const r = await this.client.get(atual);
      if (r.status >= 300 && r.status < 400 && r.headers.location) {
        atual = r.headers.location.startsWith("http")
          ? r.headers.location
          : `https://sigeduc.rn.gov.br${r.headers.location}`;
        continue;
      }
      return r;
    }
    throw new Error("Muitos redirects");
  }

  async _post(url, body) {
    let atual = url;
    let metodo = "post";
    let dados = body;
    for (let i = 0; i < 6; i++) {
      const r = await this.client[metodo](atual, dados, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (r.status >= 300 && r.status < 400 && r.headers.location) {
        atual = r.headers.location.startsWith("http")
          ? r.headers.location
          : `https://sigeduc.rn.gov.br${r.headers.location}`;
        metodo = "get";
        dados = undefined;
        continue;
      }
      return r;
    }
    throw new Error("Muitos redirects");
  }

  /**
   * Login + extrai lista de vínculos da página
   */
  async login(matricula, senha) {
    const url = `${BASE}/logar.do?dispatch=logOn`;
    const body = new URLSearchParams({
      urlRedirect: "", acao: "", acessibilidade: "",
      "user.login": matricula, "user.senha": senha,
    });

    const r = await this._post(url, body.toString());
    const html = this._text(r.data);

    const ok = !html.includes("Sua sessão foi expirada") &&
               (html.includes("vinculos") || html.includes("Escolha seu V") ||
                html.includes("escolhaVinculo") || r.status === 200);

    if (!ok) {
      console.log(`[LOGIN] FALHOU (${html.length} bytes)`);
      return false;
    }

    // Extrai os vínculos disponíveis
    this.vinculos = this._extrairVinculos(html);
    console.log(`[LOGIN] OK (${html.length} bytes) — ${this.vinculos.length} vínculos encontrados`);
    for (const v of this.vinculos) {
      console.log(`         vínculo ${v.id}: ${v.escola} / ${v.serie} (${v.ano})`);
    }

    return true;
  }

  /**
   * Procura na página de vínculos todos os links escolhaVinculo.do?vinculo=N
   */
  _extrairVinculos(html) {
    const vinculos = [];
    const regex = /escolhaVinculo\.do\?dispatch=escolher(?:&amp;|&)vinculo=(\d+)/g;
    let m;
    const vistos = new Set();

    while ((m = regex.exec(html)) !== null) {
      const id = parseInt(m[1]);
      if (vistos.has(id)) continue;
      vistos.add(id);
      vinculos.push({ id });
    }

    // Tenta enriquecer com dados da tabela (escola/série/ano)
    const linhas = html.split(/<tr[^>]*>/);
    for (const linha of linhas) {
      const matchVinc = linha.match(/vinculo=(\d+)/);
      if (!matchVinc) continue;
      const id = parseInt(matchVinc[1]);
      const v = vinculos.find(x => x.id === id);
      if (!v) continue;

      // Extrai textos das células
      const tds = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, "").trim())
        .filter(t => t);

      if (tds.length >= 4) {
        v.escola = tds.find(t => t.toUpperCase().includes("ESCOLA") || t.includes("ESTADUAL")) || "";
        v.serie = tds.find(t => t.match(/S[ÉE]RIE|ANO/)) || "";
        v.ano = tds.find(t => /^\d{4}$/.test(t)) || "";
        v.turma = tds.find(t => /INFM|T\.I/i.test(t)) || "";
      }
    }

    return vinculos;
  }

  /**
   * Escolhe o vínculo "atual" (o mais recente — ano mais alto)
   */
  async escolherVinculoAutomatico() {
    if (!this.vinculos || this.vinculos.length === 0) {
      console.log("   ⚠ Nenhum vínculo detectado — usando o 1");
      return this.escolherVinculo(1);
    }

    // Ordena por ano (mais recente primeiro)
    const ordenado = [...this.vinculos].sort((a, b) => {
      const anoA = parseInt(a.ano) || 0;
      const anoB = parseInt(b.ano) || 0;
      return anoB - anoA;
    });

    const escolhido = ordenado[0];
    console.log(`   → Escolhendo vínculo ${escolhido.id} (${escolhido.escola || "?"} / ${escolhido.ano || "?"})`);

    return this.escolherVinculo(escolhido.id);
  }

  async escolherVinculo(v) {
    const url = `${BASE}/escolhaVinculo.do?dispatch=escolher&vinculo=${v}`;
    const r = await this._get(url);
    this.vinculoAtivo = v;
    return r.status >= 200 && r.status < 400;
  }

  async portal() {
    const url = `${BASE}/verPortalDiscente.do`;
    const r = await this._get(url);
    const html = this._text(r.data);
    console.log(`   → portal raw: status=${r.status} tamanho=${html.length}`);
    return html;
  }

  async discenteMedio() {
    const url = `${BASE}/portais/discente/medio/discente_medio.jsf`;
    const r = await this._get(url);
    return this._text(r.data);
  }

  async _acionarMenu(acao) {
    const html = await this.discenteMedio();
    const viewState = this._viewState(html);
    const body = new URLSearchParams({
      "menu:form_menu_discente": "menu:form_menu_discente",
      DOUBLE_CHECK_TOKEN: "",
      id: "1537154",
      jscook_action: acao,
      "javax.faces.ViewState": viewState,
    });
    const r = await this._post(
      `${BASE}/portais/discente/medio/discente_medio.jsf`,
      body.toString()
    );
    return this._text(r.data);
  }

  async boletim() {
    const a = "menu_form_menu_discente_j_id_jsp_51238765_96_menu:A]#{ boletimMedioMBean.iniciarEstudanteBaseComum }";
    return this._acionarMenu(a);
  }

  async frequencia() {
    const a = "menu_form_menu_discente_j_id_jsp_51238765_96_menu:A]#{ acompanhamentoFrequenciaBimestralAlunoMBean.init }";
    return this._acionarMenu(a);
  }

  async avaliacoes() {
    const a = "menu_form_menu_discente_j_id_jsp_51238765_96_menu:A]#{ dataAvaliacao.iniciarByDiscente }";
    return this._acionarMenu(a);
  }

  async historico() {
    const a = "menu_form_menu_discente_j_id_jsp_51238765_96_menu:A]#{ historicoEscolarMBean.emitirHistoricoByDiscente }";
    return this._acionarMenu(a);
  }

  async calendario() {
    const a = "menu_form_menu_discente_j_id_jsp_51238765_96_menu:A]#{ gerenciarCalendarioEscolarMBean.acessarUrl }";
    return this._acionarMenu(a);
  }

  async escolaDigital() {
    const r = await this._get(`${BASE}/ava/index.jsf`);
    return this._text(r.data);
  }
}
