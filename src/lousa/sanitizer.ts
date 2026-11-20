/**
 * TUTORIA - Módulo de Sanitização e Formatação da Lousa
 * Garante segurança total contra injeção de scripts (RF06, CA08, CT08, RNF02).
 */

/**
 * Escapa caracteres especiais HTML.
 */
export function escapeHtml(texto: string): string {
  if (texto === null || texto === undefined || texto === '') return '';
  // O modelo às vezes manda números/booleanos em células e opções: nunca quebrar a lousa por isso
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Converte notações matemáticas LaTeX comuns, sobrescritos e subscritos em HTML seguro.
 * Toda conversão opera após `escapeHtml()` para impedir injeção de HTML/XSS (RF03, RNF01).
 */
export function formatarFormula(formula: string): string {
  if (formula === null || formula === undefined || formula === '') return '';
  const escapado = escapeHtml(String(formula));

  // Remove delimitadores LaTeX ($...$, $$...$$) e modificadores de tamanho (\left, \right)
  let processado = escapado
    .replace(/(?<![A-Z])\$\$?/g, '') // preserva "R$" e "US$"
    .replace(/\\(?:left|right)(?![a-zA-Z])/g, '');

  // Texto e raízes em LaTeX
  processado = processado
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, '$1')
    .replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '<sup>$1</sup>√($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // Frações \frac{a}{b} (duas passadas para suportar frações aninhadas simples)
  for (let i = 0; i < 2; i++) {
    processado = processado.replace(
      /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
      '<span class="formula-frac"><sup>$1</sup>⁄<sub>$2</sub></span>'
    );
  }

  // Setas, operadores e símbolos matemáticos/químicos
  processado = processado
    .replace(/\\(?:to|rightarrow|longrightarrow)(?![a-zA-Z])/g, '→')
    .replace(/\\(?:leftarrow|longleftarrow)(?![a-zA-Z])/g, '←')
    .replace(/\\(?:leftrightarrow|rightleftharpoons)(?![a-zA-Z])/g, '⇄')
    .replace(/\\(?:times|cdot)(?![a-zA-Z])/g, '×')
    .replace(/\\div(?![a-zA-Z])/g, '÷')
    .replace(/\\pm(?![a-zA-Z])/g, '±')
    .replace(/\\(?:neq|ne)(?![a-zA-Z])/g, '≠')
    .replace(/\\(?:leq|le)(?![a-zA-Z])/g, '≤')
    .replace(/\\(?:geq|ge)(?![a-zA-Z])/g, '≥')
    .replace(/\\approx(?![a-zA-Z])/g, '≈')
    .replace(/\\pi(?![a-zA-Z])/g, 'π')
    .replace(/\\Delta(?![a-zA-Z])/g, 'Δ');

  // Sobrescrito com chaves: ^{...}
  processado = processado.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  // Sobrescrito simples: ^2, ^x, ^12 (números ou letra única)
  processado = processado.replace(/\^([0-9]+|[a-zA-Z])/g, '<sup>$1</sup>');

  // Subscrito com chaves: _{...}
  processado = processado.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  // Subscrito simples: _2, _n, _12 (números ou letra única)
  processado = processado.replace(/_([0-9]+|[a-zA-Z])/g, '<sub>$1</sub>');

  return processado.replace(/\s{2,}/g, ' ').trim();
}

const TAGS_SVG_PERMITIDAS = new Set([
  'svg',
  'g',
  'line',
  'rect',
  'circle',
  'ellipse',
  'path',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'marker'
]);

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Valor de atributo perigoso: script embutido, expressão CSS ou referência externa via url(). */
function valorAtributoPerigoso(nome: string, valor: string): boolean {
  const v = valor.toLowerCase().replace(/[\s\u0000-\u001f]+/g, '');
  if (v.includes('javascript:') || v.includes('vbscript:') || v.includes('data:text/html') || v.includes('expression(')) {
    return true;
  }
  // Links só para âncoras internas do próprio desenho (ex.: marcadores e gradientes)
  if (nome === 'href' || nome.endsWith(':href') || nome === 'src') return !v.startsWith('#');
  // url() só pode apontar para ids internos: bloqueia rastreio e carregamento externo
  if (/url\((?!['"]?#)/.test(v)) return true;
  return false;
}

/**
 * Sanitiza estritamente strings SVG geradas pelo modelo (RF06 / CA08 / CT08).
 *
 * Em vez de "limpar" a árvore parseada (o que deixa passar comentários, instruções de
 * processamento e CDATA, que o `outerHTML` reescreve e o `innerHTML` reinterpreta como HTML),
 * reconstrói um SVG novo copiando apenas elementos da lista permitida, atributos seguros e
 * nós de texto. Qualquer outro nó é descartado.
 */
export function sanitizarSvg(svgString: string): string {
  if (!svgString || typeof svgString !== 'string') return '';
  // Sem DOM não há como garantir a sanitização: melhor não desenhar do que arriscar
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // Se houve erro de parse de XML
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.warn('SVG com erro de sintaxe XML na lousa:', parserError.textContent);
      return '';
    }

    const origem = doc.documentElement;
    if (!origem || origem.localName.toLowerCase() !== 'svg') {
      return '';
    }

    const copiar = (el: Element): Element | null => {
      const tag = el.localName;
      if (!TAGS_SVG_PERMITIDAS.has(tag.toLowerCase())) return null;

      const novo = document.createElementNS(SVG_NS, tag);
      for (const attr of Array.from(el.attributes)) {
        const nome = attr.name.toLowerCase();
        if (nome.startsWith('on') || nome.startsWith('xmlns')) continue;
        if (valorAtributoPerigoso(nome, attr.value)) continue;
        try {
          if (attr.namespaceURI) {
            novo.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
          } else {
            novo.setAttribute(attr.name, attr.value);
          }
        } catch {
          // Nome de atributo inválido: descarta
        }
      }

      for (const filho of Array.from(el.childNodes)) {
        if (filho.nodeType === 1) {
          const copia = copiar(filho as Element);
          if (copia) novo.appendChild(copia);
        } else if (filho.nodeType === 3) {
          // Só texto puro; comentários (8), instruções de processamento (7) e CDATA (4) são descartados
          novo.appendChild(document.createTextNode(filho.textContent ?? ''));
        }
      }
      return novo;
    };

    const svgElement = copiar(origem);
    if (!svgElement) return '';

    // Garante atributos de responsividade no SVG raiz
    if (!svgElement.getAttribute('viewBox')) {
      const width = parseFloat(svgElement.getAttribute('width') || '') || 200;
      const height = parseFloat(svgElement.getAttribute('height') || '') || 150;
      svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    svgElement.setAttribute('width', '100%');
    svgElement.removeAttribute('height');
    svgElement.classList.add('lousa-desenho-svg');

    return svgElement.outerHTML;
  } catch (err) {
    console.error('Erro na sanitização de SVG:', err);
    return '';
  }
}
