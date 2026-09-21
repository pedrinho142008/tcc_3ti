import iconv from "iconv-lite";

const BASE = "https://sigeduc.rn.gov.br/sigeduc";
const TIMEOUT = 60000;

export class SigEducClient {
  constructor() {
    this.cookies = new Map();
    this.vinculos = [];
    this.vinculoAtivo = null;
  }

  _cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  _saveCookies(headers) {
    // Node 22 tem headers.getSetCookie()
    const setCookies = headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const k = pair.slice(0, eq).trim();
        const v = pair.slice(eq + 1).trim();
        if (k && v) this.cookies.set(k, v);
      }
    }
  }

  _text(buffer) {
    try {
      const utf8 = buffer.toString("utf8");
      if (utf8.includes("\uFFFD")) return iconv.decode(buffer, "ISO-8859-1");
      return utf8;
    } catch {
      return iconv.decode(buffer, "ISO-8859-1");
    }
  }

  async _fetch(url, opts = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const r = await fetch(url, {
        ...opts,
        signal: controller.signal,
        redirect: "manual",     // ← Manual pra controlar
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Origin": "https://sigeduc.rn.gov.br",
          "Cookie": this._cookieHeader(),
          ...(opts.headers || {}),
        },
      });
      this._saveCookies(r.headers);
      const buffer = Buffer.from(await r.arrayBuffer());
      return {
        status: r.status,
        text: this._text(buffer),
        headers: r.headers,
        location: r.headers.get("location"),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async _get(url) {
    let atual = url;
    for (let i = 0; i < 6; i++) {
      const r = await this._fetch(atual);
      if (r.status >= 300 && r.status < 400 && r.location) {
        atual = r.location.startsWith("http")
          ? r.location
          : `https://sigeduc.rn.gov.br${r.location}`;
        continue;
      }
      return r;
    }
    throw new Error("Muitos redirects");
  }

  async _post(url, body) {
    let atual = url;
    let metodo = "POST";
    let dados = body;
    for (let i = 0; i < 6; i++) {
      const r = await this._fetch(atual, {
        method: metodo,
        body: dados,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      if (r.status >= 300 && r.status < 400 && r.location) {
        atual = r.location.startsWith("http")
          ? r.location
          : `https://sigeduc.rn.gov.br${r.location}`;
        metodo = "GET";
        dados = undefined;
        continue;
      }
      return r;
    }
    throw new Error("Muitos redirects");
  }

  _viewState(html) {
    const m = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
    return m ? m[1] : "j_id1";
  }

  async login(matricula, senha) {
    const url = `${BASE}/logar.do?dispatch=logOn`;
    const body = new URLSearchParams({
      urlRedirect: "", acao: "", acessibilidade: "",
      "user.login": matricula, "user.senha": senha,
    }).toString();

    const r = await this._post(url, body);
    const html = r.text;
    const ok = !html.includes("Sua sessão foi expirada") &&
               (html.includes("vinculos") || html.includes("Escolha seu V") ||
                html.includes("escolhaVinculo") || r.status === 200);

    console.log(`[LOGIN] ${ok ? "OK" : "FALHOU"} (${html.length} bytes)`);

    if (ok) {
      this.vinculos = this._extrairVinculos(html);
      console.log(`         ${this.vinculos.length} vínculos encontrados`);
      for (const v of this.vinculos) {
        console.log(`         vínculo ${v.id}: ${v.escola || "?"} / ${v.ano || "?"}`);
      }
    }

    return ok;
  }

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

    // Enriquece com dados da linha
    const linhas = html.split(/<tr[^>]*>/);
    for (const linha of linhas) {
      const matchVinc = linha.match(/vinculo=(\d+)/);
      if (!matchVinc) continue;
      const id = parseInt(matchVinc[1]);
      const v = vinculos.find(x => x.id === id);
      if (!v) continue;

      const tds = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, "").trim())
        .filter(t => t);

      if (tds.length >= 4) {
        v.escola = tds.find(t => t.toUpperCase().includes("ESCOLA") || t.includes("ESTADUAL")) || "";
        v.serie = tds.find(t => t.match(/S[ÉE]RIE|ANO/)) || "";
        v.ano = tds.find(t => /^\d{4}$/.test(t)) || "";
      }
    }

    return vinculos;
  }

  async escolherVinculoAutomatico() {
    if (!this.vinculos || this.vinculos.length === 0) {
      console.log("   ⚠ Nenhum vínculo detectado — usando o 1");
      return this.escolherVinculo(1);
    }

    const ordenado = [...this.vinculos].sort((a, b) => {
      return (parseInt(b.ano) || 0) - (parseInt(a.ano) || 0);
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
    console.log(`   → portal raw: status=${r.status} tamanho=${r.text.length}`);
    return r.text;
  }

  async discenteMedio() {
    const url = `${BASE}/portais/discente/medio/discente_medio.jsf`;
    const r = await this._get(url);
    return r.text;
  }

  async _acionarMenu(acao) {
    const html = await this.discenteMedioSafe();
    const viewState = this._viewState(html);
    const body = new URLSearchParams({
      "menu:form_menu_discente": "menu:form_menu_discente",
      DOUBLE_CHECK_TOKEN: "",
      id: "1537154",
      jscook_action: acao,
      "javax.faces.ViewState": viewState,
    }).toString();

    const r = await this._post(
      `${BASE}/portais/discente/medio/discente_medio.jsf`,
      body
    );
    return r.text;
  }

  async discenteMedioSafe() { return this.discenteMedio(); }

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
    return r.text;
  }
}
