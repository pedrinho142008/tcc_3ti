
(() => {
  'use strict';

  const normalizar = texto =>
    (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const texto = el => normalizar(el.textContent);

  // Atualização dos nomes das áreas.
  function atualizarNomes() {
    document.querySelectorAll('a, button, span, h1, h2, h3, label')
      .forEach(el => {
        if (el.children.length > 0) return;

        const t = texto(el);

        if (t === 'portal do aluno') {
          el.textContent = 'Área do Aluno';
        }

        if (t === 'portal do responsavel' ||
            t === 'portal dos responsaveis') {
          el.textContent = 'Área dos Responsáveis';
        }
      });
  }

  // Remoção de elementos exclusivamente relacionados à gamificação.
  function removerGamificacao() {
    const seletores = [
      '[data-gamificacao]',
      '#gamificacao',
      '#gamification',
      '.gamificacao',
      '.gamification',
      '.ranking-alunos',
      '.ranking-gamificacao',
      '.conquistas',
      '.medalhas',
      '.missoes',
      '.pontuacao-gamificacao',
      '.badges-container',
      '.achievements'
    ];

    document.querySelectorAll(seletores.join(','))
      .forEach(el => el.remove());

    const termos = [
      'gamificacao',
      'gamification',
      'ranking de pontos',
      'minhas conquistas',
      'minhas medalhas',
      'missoes e desafios'
    ];

    document.querySelectorAll(
      'a, button, [role="tab"], .nav-item'
    ).forEach(el => {
      if (el.children.length > 0) return;

      const t = texto(el);

      if (termos.some(p => t.includes(p))) {
        el.remove();
      }
    });
  }

  // Identifica a área do aluno sem remover outros módulos.
  function encontrarAreaAluno() {
    const candidatos = [
      '#area-aluno',
      '#painel-aluno',
      '#aluno',
      '[data-area="aluno"]',
      '.area-aluno',
      '.painel-aluno'
    ];

    for (const seletor of candidatos) {
      const el = document.querySelector(seletor);
      if (el) return el;
    }

    return null;
  }

  // Move a entrada da Merenda para a navegação do aluno.
  function moverMerenda() {
    const area = encontrarAreaAluno();
    if (!area) return;

    const itens = [...document.querySelectorAll(
      'a, button, [role="tab"], .nav-item'
    )];

    const merenda = itens.find(el => {
      const t = texto(el);
      return t === 'merenda' || t === 'cardapio escolar';
    });

    if (!merenda || area.contains(merenda)) return;

    const destino =
      area.querySelector(
        '.nav-tabs, .nav-menu, .menu-aluno, .abas, nav'
      ) || area;

    if (destino) {
      destino.appendChild(merenda);
    }
  }

  // Melhorias de carregamento das imagens.
  function otimizarImagens() {
    document.querySelectorAll('img').forEach((img, i) => {
      if (!img.hasAttribute('loading') && i > 2) {
        img.loading = 'lazy';
      }

      if (!img.hasAttribute('decoding')) {
        img.decoding = 'async';
      }
    });
  }

  // O mapa só carrega quando estiver próximo da tela.
  function otimizarMapa() {
    document.querySelectorAll('iframe').forEach(frame => {
      const src = frame.getAttribute('src') || '';

      if (/google\.com\/maps|maps\.google|openstreetmap/i.test(src)) {
        frame.loading = 'lazy';
        frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

        if (!frame.hasAttribute('title')) {
          frame.title = 'Mapa de localização da escola';
        }
      }
    });
  }

  function executar() {
    atualizarNomes();
    removerGamificacao();
    moverMerenda();
    otimizarImagens();
    otimizarMapa();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executar, {
      once: true
    });
  } else {
    executar();
  }

  // Reaplica os ajustes quando os painéis dinâmicos forem carregados.
  let agendado = false;

  const observador = new MutationObserver(() => {
    if (agendado) return;

    agendado = true;

    requestAnimationFrame(() => {
      executar();
      agendado = false;
    });
  });

  observador.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

})();

