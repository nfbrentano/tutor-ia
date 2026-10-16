/**
 * TUTORIA - Renderizador de Itens da Lousa por Tipo
 * (RF03, CA04, CA11, RNF02)
 */

import { formatarFormula, sanitizarSvg } from './sanitizer';
import { ImagemConteudo, ItemLousa } from './tipos';

export function renderizarItemLousa(
  item: ItemLousa,
  onCliqueImagem?: (url: string, legenda?: string) => void
): HTMLElement | null {
  const container = document.createElement('div');
  container.className = `lousa-item lousa-item-${item.tipo}`;
  container.setAttribute('data-tipo', item.tipo);

  switch (item.tipo) {
    case 'texto': {
      const texto = typeof item.conteudo === 'string' ? item.conteudo : '';
      if (!texto.trim()) return null;
      const el = document.createElement('div');
      el.className = 'lousa-conteudo-texto';
      el.textContent = texto;
      container.appendChild(el);
      break;
    }

    case 'formula': {
      const formulaStr = typeof item.conteudo === 'string' ? item.conteudo : '';
      if (!formulaStr.trim()) return null;
      const el = document.createElement('div');
      el.className = 'lousa-conteudo-formula';
      el.innerHTML = formatarFormula(formulaStr);
      container.appendChild(el);
      break;
    }

    case 'passos': {
      const passos = Array.isArray(item.conteudo) ? item.conteudo : [String(item.conteudo)];
      if (passos.length === 0) return null;
      const ol = document.createElement('ol');
      ol.className = 'lousa-conteudo-passos';
      passos.forEach((p, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="passo-numero">${idx + 1}</span><div class="passo-corpo">${formatarFormula(
          String(p)
        )}</div>`;
        ol.appendChild(li);
      });
      container.appendChild(ol);
      break;
    }

    case 'lista': {
      const itens = Array.isArray(item.conteudo) ? item.conteudo : [String(item.conteudo)];
      if (itens.length === 0) return null;
      const ul = document.createElement('ul');
      ul.className = 'lousa-conteudo-lista';
      itens.forEach(it => {
        const li = document.createElement('li');
        li.innerHTML = formatarFormula(String(it));
        ul.appendChild(li);
      });
      container.appendChild(ul);
      break;
    }

    case 'tabela': {
      const tab = item.conteudo as any;
      const cabecalho = tab?.cabecalho || tab?.colunas;
      if (!tab || !cabecalho || !tab.linhas) return null;

      const wrap = document.createElement('div');
      wrap.className = 'lousa-tabela-scroll';

      const table = document.createElement('table');
      table.className = 'lousa-tabela';

      // Thead
      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      (cabecalho as string[]).forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);

      // Tbody
      const tbody = document.createElement('tbody');
      (tab.linhas as string[][]).forEach(linha => {
        const tr = document.createElement('tr');
        linha.forEach(celula => {
          const td = document.createElement('td');
          td.innerHTML = formatarFormula(celula);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      container.appendChild(wrap);
      break;
    }

    case 'imagem': {
      const imgData = item.conteudo as ImagemConteudo;
      if (!imgData || !imgData.urlReal) return null;

      const imgBox = document.createElement('div');
      imgBox.className = 'lousa-imagem-box';

      const img = document.createElement('img');
      img.src = imgData.urlReal;
      img.alt = imgData.legenda || imgData.termo || 'Ilustração didática';
      img.className = 'lousa-img';
      img.loading = 'lazy';

      img.addEventListener('click', () => {
        onCliqueImagem?.(imgData.urlReal!, imgData.legenda || imgData.termo);
      });

      imgBox.appendChild(img);

      if (imgData.legenda || item.legenda) {
        const leg = document.createElement('div');
        leg.className = 'lousa-img-legenda lousa-item-legenda';
        leg.textContent = imgData.legenda || item.legenda || '';
        imgBox.appendChild(leg);
      }

      if (imgData.autor || imgData.licenca) {
        const cred = document.createElement('div');
        cred.className = 'lousa-img-credito';
        cred.textContent = `Fonte: ${imgData.autor || 'Wikimedia'} (${imgData.licenca || 'CC'})`;
        imgBox.appendChild(cred);
      }

      container.appendChild(imgBox);
      break;
    }

    case 'desenho': {
      const svgRaw = typeof item.conteudo === 'string' ? item.conteudo : '';
      const svgSanitizado = sanitizarSvg(svgRaw);
      if (!svgSanitizado) return null;

      const drawWrap = document.createElement('div');
      drawWrap.className = 'lousa-desenho-container';
      drawWrap.innerHTML = svgSanitizado;

      if (item.legenda) {
        const leg = document.createElement('div');
        leg.className = 'lousa-desenho-legenda lousa-item-legenda';
        leg.textContent = item.legenda;
        drawWrap.appendChild(leg);
      }

      container.appendChild(drawWrap);
      break;
    }

    default:
      return null;
  }

  return container;
}
