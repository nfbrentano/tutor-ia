/**
 * TUTORIA - Módulo de Sanitização e Formatação da Lousa
 * Garante segurança total contra injeção de scripts (RF06, CA08, CT08, RNF02).
 */

/**
 * Escapa caracteres especiais HTML.
 */
export function escapeHtml(texto: string): string {
  if (!texto) return '';
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Converte notações matemáticas simples de sobrescrito e subscrito em HTML seguro.
 * Exemplos:
 * x^2 -> x<sup>2</sup>
 * x^{n+1} -> x<sup>n+1</sup>
 * H_2O -> H<sub>2</sub>O
 * a_n -> a<sub>n</sub>
 */
export function formatarFormula(formula: string): string {
  if (!formula) return '';
  const escapado = escapeHtml(formula);

  // Sobrescrito com chaves: ^{...}
  let processado = escapado.replace(/\^{([^}]+)}/g, '<sup>$1</sup>');
  // Sobrescrito simples: ^2, ^x, ^12 (números ou letra única)
  processado = processado.replace(/\^([0-9]+|[a-zA-Z])/g, '<sup>$1</sup>');

  // Subscrito com chaves: _{...}
  processado = processado.replace(/_{([^}]+)}/g, '<sub>$1</sub>');
  // Subscrito simples: _2, _n, _12 (números ou letra única)
  processado = processado.replace(/_([0-9]+|[a-zA-Z])/g, '<sub>$1</sub>');

  return processado;
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

/**
 * Sanitiza estritamente strings SVG geradas pelo modelo (RF06 / CA08 / CT08).
 * Remove qualquer script, handlers on* e referências externas.
 */
export function sanitizarSvg(svgString: string): string {
  if (!svgString || typeof svgString !== 'string') return '';

  if (typeof DOMParser === 'undefined') {
    // Ambiente de teste sem DOMParser nativo: fallback regex de segurança
    return svgString
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/\s+on[a-zA-Z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s+on[a-zA-Z]+\s*=[^\s>]+/gi, '')
      .trim();
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // Se houve erro de parse de XML
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.warn('SVG com erro de sintaxe XML na lousa:', parserError.textContent);
      return '';
    }

    const svgElement = doc.documentElement;
    if (svgElement.tagName.toLowerCase() !== 'svg') {
      return '';
    }

    // Função recursiva de limpeza
    const limparElemento = (el: Element): boolean => {
      const tagName = el.tagName.toLowerCase();

      // Se a tag não for permitida, remove
      if (!TAGS_SVG_PERMITIDAS.has(tagName)) {
        return false;
      }

      // Remove atributos maliciosos
      const atributos = Array.from(el.attributes);
      for (const attr of atributos) {
        const nome = attr.name.toLowerCase();
        const valor = attr.value.toLowerCase().trim();

        // Remove handlers on* (ex: onload, onclick)
        if (nome.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }

        // Remove links javascript: ou URLs externas
        if (nome === 'href' || nome.endsWith(':href') || nome === 'src') {
          if (valor.startsWith('javascript:') || valor.startsWith('http:') || valor.startsWith('https:')) {
            el.removeAttribute(attr.name);
          }
        }
      }

      // Limpa os filhos
      const filhos = Array.from(el.children);
      for (const filho of filhos) {
        const permitido = limparElemento(filho);
        if (!permitido) {
          el.removeChild(filho);
        }
      }

      return true;
    };

    const raizValida = limparElemento(svgElement);
    if (!raizValida) return '';

    // Garante atributos de responsividade no SVG raiz
    if (!svgElement.getAttribute('viewBox')) {
      const width = svgElement.getAttribute('width') || '200';
      const height = svgElement.getAttribute('height') || '150';
      svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', 'auto');
    svgElement.classList.add('lousa-desenho-svg');

    return svgElement.outerHTML;
  } catch (err) {
    console.error('Erro na sanitização de SVG:', err);
    return '';
  }
}
