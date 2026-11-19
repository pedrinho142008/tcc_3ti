#!/data/data/com.termux/files/usr/bin/bash

set -e

ROOT="$(pwd)"
DATA="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backup-modernizacao-$DATA"

echo "=========================================="
echo "  MODERNIZAÇÃO DO PORTAL E.E.I.M."
echo "=========================================="

mkdir -p "$BACKUP"

echo "[1/5] Criando backup..."

cp -a public "$BACKUP/" 2>/dev/null || true
cp -a server "$BACKUP/" 2>/dev/null || true
cp -a package.json "$BACKUP/" 2>/dev/null || true

mkdir -p public/css public/js

echo "[2/5] Criando novo visual..."

cat <<'CSS' > public/css/portal-modernizacao.css

:root {
  --portal-blue: #102d59;
  --portal-blue-dark: #091d3b;
  --portal-yellow: #ffcc32;
  --portal-background: #f4f6fb;
  --portal-text: #192b45;
  --portal-radius: 16px;
}

html {
  scroll-behavior: smooth;
}

body {
  background: var(--portal-background);
  color: var(--portal-text);
  font-family: Inter, "Segoe UI", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button, a, input, select, textarea {
  -webkit-tap-highlight-color: transparent;
}

button, a {
  transition: background-color .16s ease,
              color .16s ease,
              border-color .16s ease;
}

button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 3px solid var(--portal-yellow);
  outline-offset: 3px;
}

header, .header, .navbar, nav, .topbar {
  position: relative;
}

.card, .dashboard-card, .stat-card,
.painel-card, .module-card {
  border-radius: var(--portal-radius);
  transition: box-shadow .18s ease,
              border-color .18s ease;
}

.card:hover, .dashboard-card:hover,
.module-card:hover {
  box-shadow: 0 8px 24px rgba(16,45,89,.09);
}

button, .btn, .button {
  border-radius: 10px;
}

img {
  max-width: 100%;
}

iframe {
  max-width: 100%;
}

@media (max-width: 768px) {
  body {
    overflow-x: hidden;
  }

  .container, .main-content, main {
    max-width: 100%;
  }

  .card, .dashboard-card, .module-card {
    border-radius: 13px;
  }

  button, .btn {
    min-height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}

CSS

echo "[3/5] Criando ajustes de navegação..."

cat <<'JS' > public/js/portal-modernizacao.js

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

JS

echo "[4/5] Integrando os arquivos às páginas..."

python - <<'PY'
from pathlib import Path
import re

root = Path("public")
html_files = list(root.rglob("*.html"))

css_tag = '<link rel="stylesheet" href="/css/portal-modernizacao.css">'
js_tag = '<script src="/js/portal-modernizacao.js" defer></script>'

alterados = 0

for arquivo in html_files:
    try:
        conteudo = arquivo.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue

    original = conteudo

    if "portal-modernizacao.css" not in conteudo:
        if re.search(r"</head\s*>", conteudo, re.I):
            conteudo = re.sub(
                r"</head\s*>",
                css_tag + "\n</head>",
                conteudo,
                count=1,
                flags=re.I
            )

    if "portal-modernizacao.js" not in conteudo:
        if re.search(r"</body\s*>", conteudo, re.I):
            conteudo = re.sub(
                r"</body\s*>",
                js_tag + "\n</body>",
                conteudo,
                count=1,
                flags=re.I
            )

    if conteudo != original:
        arquivo.write_text(conteudo, encoding="utf-8")
        alterados += 1

print(f"Páginas HTML integradas: {alterados}")
PY

echo "[5/5] Verificando arquivos..."

test -s public/css/portal-modernizacao.css
test -s public/js/portal-modernizacao.js

echo
echo "=========================================="
echo " MODERNIZAÇÃO APLICADA"
echo "=========================================="
echo
echo "Backup: $BACKUP"
echo
echo "Arquivos criados:"
echo " public/css/portal-modernizacao.css"
echo " public/js/portal-modernizacao.js"
echo
echo "Páginas HTML integradas: $alterados"
echo
echo "IMPORTANTE:"
echo "- Confira a navegação da Área do Aluno."
echo "- Confira a posição da aba Merenda."
echo "- Verifique se a gamificação também é gerada"
echo "  pelo servidor antes de remover seus módulos."
echo "- O mapa usa carregamento lazy, não altera"
echo "  o provedor nem acelera a conexão externa."
echo
echo "Para reverter, restaure os arquivos do backup."
