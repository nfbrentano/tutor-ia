/**
 * TUTORIA - Renderizador de Itens da Lousa por Tipo
 * (RF03, CA04, CA11, RNF02)
 */

import { escapeHtml, formatarFormula, sanitizarSvg } from './sanitizer';
import {
  DesafioQuiz,
  EventoRespostaQuiz,
  GraficoConteudo,
  ImagemConteudo,
  ItemLousa,
  OnResponderQuizCallback,
  PontoGrafico
} from './tipos';

const LETRAS_ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E', 'F'];

function montarGraficoCartesiano(
  grafico: GraficoConteudo,
  legendaItem?: string
): HTMLElement | null {
  if (!grafico || !Array.isArray(grafico.pontos)) return null;

  // RNF02: filtra estritamente pares numéricos finitos, nunca avalia expressões com eval/Function
  const pontosValidos: PontoGrafico[] = [];
  for (const pt of grafico.pontos) {
    if (!pt || typeof pt !== 'object') continue;
    if (pt.x === null || pt.y === null || typeof pt.x === 'boolean' || typeof pt.y === 'boolean') continue;
    const x = typeof pt.x === 'number' ? pt.x : Number(pt.x);
    const y = typeof pt.y === 'number' ? pt.y : Number(pt.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pontosValidos.push({ x, y });
    }
  }

  if (pontosValidos.length === 0) return null;

  const xs = pontosValidos.map((p) => p.x);
  const ys = pontosValidos.map((p) => p.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  // Margem visual pequena no eixo Y para curvas não colarem nas bordas
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  minY -= spanY * 0.08;
  maxY += spanY * 0.08;

  const largura = 320;
  const altura = 220;
  const padL = 40;
  const padR = 18;
  const padT = 18;
  const padB = 28;
  const areaW = largura - padL - padR;
  const areaH = altura - padT - padB;

  const mapX = (x: number) => Number((padL + ((x - minX) / spanX) * areaW).toFixed(1));
  const mapY = (y: number) => Number((padT + (1 - (y - minY) / (maxY - minY)) * areaH).toFixed(1));

  // Grade cartesiana
  const gridLinhas: string[] = [];
  const divisoes = 4;
  for (let i = 0; i <= divisoes; i++) {
    const gx = Number((padL + (areaW * i) / divisoes).toFixed(1));
    const gy = Number((padT + (areaH * i) / divisoes).toFixed(1));
    gridLinhas.push(`<line class="grafico-grade" x1="${gx}" y1="${padT}" x2="${gx}" y2="${padT + areaH}" />`);
    gridLinhas.push(`<line class="grafico-grade" x1="${padL}" y1="${gy}" x2="${padL + areaW}" y2="${gy}" />`);
  }

  // Eixos X e Y (no zero se estiver dentro da janela; caso contrário nas bordas)
  const yZeroDentro = minY <= 0 && maxY >= 0;
  const xZeroDentro = minX <= 0 && maxX >= 0;
  const yEixoX = yZeroDentro ? mapY(0) : padT + areaH;
  const xEixoY = xZeroDentro ? mapX(0) : padL;

  const coords = pontosValidos.map((p) => ({ x: mapX(p.x), y: mapY(p.y), raw: p }));

  // Caminho suave quadrático pelos pontos médios quando houver >= 2 pontos
  let dPath = '';
  if (coords.length >= 2) {
    dPath = `M ${coords[0].x} ${coords[0].y}`;
    if (coords.length === 2) {
      dPath += ` L ${coords[1].x} ${coords[1].y}`;
    } else {
      for (let i = 1; i < coords.length - 1; i++) {
        const midX = Number(((coords[i].x + coords[i + 1].x) / 2).toFixed(1));
        const midY = Number(((coords[i].y + coords[i + 1].y) / 2).toFixed(1));
        dPath += ` Q ${coords[i].x} ${coords[i].y} ${midX} ${midY}`;
      }
      const ultimo = coords[coords.length - 1];
      dPath += ` L ${ultimo.x} ${ultimo.y}`;
    }
  }

  const circulosSvg = coords
    .map(
      (c) =>
        `<circle class="grafico-ponto" cx="${c.x}" cy="${c.y}" r="3.5"><title>(${escapeHtml(String(c.raw.x))}, ${escapeHtml(String(c.raw.y))})</title></circle>`
    )
    .join('');

  const tituloTexto = (grafico.titulo || legendaItem || '').trim();
  const rotuloX = escapeHtml((grafico.eixoX || 'x').trim().slice(0, 12));
  const rotuloY = escapeHtml((grafico.eixoY || 'y').trim().slice(0, 12));
  const formatNum = (n: number) => escapeHtml(Number.isInteger(n) ? String(n) : n.toFixed(1));

  const ariaTitulo = escapeHtml((tituloTexto || 'Gráfico cartesiano').replace(/[<>]/g, ''));

  const svgMarkup = `
    <svg class="lousa-grafico-svg" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${ariaTitulo}">
      ${gridLinhas.join('\n      ')}
      <line class="grafico-eixo" x1="${padL}" y1="${yEixoX}" x2="${padL + areaW}" y2="${yEixoX}" />
      <line class="grafico-eixo" x1="${xEixoY}" y1="${padT}" x2="${xEixoY}" y2="${padT + areaH}" />
      ${dPath ? `<path class="grafico-curva" d="${dPath}" fill="none" />` : ''}
      ${circulosSvg}
      <text class="grafico-rotulo" x="${padL}" y="${padT + areaH + 16}" text-anchor="start">${formatNum(minX)}</text>
      <text class="grafico-rotulo" x="${padL + areaW}" y="${padT + areaH + 16}" text-anchor="end">${formatNum(maxX)} (${rotuloX})</text>
      <text class="grafico-rotulo" x="${padL - 5}" y="${padT + 8}" text-anchor="end">${formatNum(maxY)}</text>
      <text class="grafico-rotulo" x="${padL - 5}" y="${padT + areaH}" text-anchor="end">${formatNum(minY)}</text>
      <text class="grafico-rotulo grafico-eixo-nome" x="${padL + 4}" y="${padT + 9}" text-anchor="start">${rotuloY}</text>
    </svg>
  `.trim();

  const wrap = document.createElement('div');
  wrap.className = 'lousa-grafico-wrap';

  if (tituloTexto) {
    const tituloEl = document.createElement('div');
    tituloEl.className = 'lousa-grafico-titulo';
    tituloEl.textContent = tituloTexto;
    wrap.appendChild(tituloEl);
  }

  const svgBox = document.createElement('div');
  svgBox.className = 'lousa-grafico-svg-box';
  svgBox.innerHTML = svgMarkup;
  wrap.appendChild(svgBox);

  if (grafico.expressao && typeof grafico.expressao === 'string' && grafico.expressao.trim()) {
    const expEl = document.createElement('div');
    expEl.className = 'lousa-grafico-expressao';
    expEl.innerHTML = formatarFormula(grafico.expressao.trim());
    wrap.appendChild(expEl);
  }

  return wrap;
}

function montarCardQuiz(
  quiz: DesafioQuiz,
  onResponderQuiz?: OnResponderQuizCallback
): HTMLElement | null {
  if (
    !quiz ||
    typeof quiz.pergunta !== 'string' ||
    !quiz.pergunta.trim() ||
    !Array.isArray(quiz.opcoes) ||
    quiz.opcoes.length < 2
  ) {
    return null;
  }

  const indiceCorreto =
    typeof quiz.correta === 'number' && quiz.correta >= 0 && quiz.correta < quiz.opcoes.length
      ? Math.floor(quiz.correta)
      : 0;

  const card = document.createElement('div');
  card.className = 'lousa-quiz-card';
  card.dataset.quizAtivo = 'true';

  const cabecalho = document.createElement('div');
  cabecalho.className = 'lousa-quiz-cabecalho';
  const badge = document.createElement('span');
  badge.className = 'lousa-quiz-badge';
  badge.textContent = '🎯 Desafio Rápido';
  cabecalho.appendChild(badge);
  card.appendChild(cabecalho);

  const perguntaEl = document.createElement('div');
  perguntaEl.className = 'lousa-quiz-pergunta';
  perguntaEl.innerHTML = formatarFormula(quiz.pergunta);
  card.appendChild(perguntaEl);

  const opcoesWrap = document.createElement('div');
  opcoesWrap.className = 'lousa-quiz-opcoes';
  opcoesWrap.setAttribute('role', 'group');
  opcoesWrap.setAttribute('aria-label', 'Alternativas do desafio');

  const feedbackEl = document.createElement('div');
  feedbackEl.className = 'lousa-quiz-feedback';
  feedbackEl.setAttribute('aria-live', 'polite');

  const acoesEl = document.createElement('div');
  acoesEl.className = 'lousa-quiz-acoes';
  const btnVerResposta = document.createElement('button');
  btnVerResposta.type = 'button';
  btnVerResposta.className = 'lousa-quiz-ver-resposta';
  btnVerResposta.textContent = 'Ver resposta';
  acoesEl.appendChild(btnVerResposta);

  const botoesOpcao: HTMLButtonElement[] = [];
  let tentativas = 0;
  let encerrado = false;

  const emitirEventoQuiz = (evento: EventoRespostaQuiz) => {
    onResponderQuiz?.(evento);
    const customEvent = new CustomEvent('lousa:quiz-respondido', {
      bubbles: true,
      detail: evento
    });
    card.dispatchEvent(customEvent);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(customEvent);
    }
  };

  const finalizarCard = () => {
    encerrado = true;
    card.dataset.quizAtivo = 'false';
    botoesOpcao.forEach((b) => {
      b.disabled = true;
    });
    btnVerResposta.disabled = true;
    btnVerResposta.classList.add('oculto');
  };

  const revelarRespostaCompleta = (indiceEscolhido: number) => {
    finalizarCard();
    botoesOpcao[indiceCorreto]?.classList.add('correta');
    const textoCorreta = quiz.opcoes[indiceCorreto] || '';
    const msg = `✅ Resposta correta: ${textoCorreta}. ${quiz.explicacao || ''}`.trim();
    feedbackEl.className = 'lousa-quiz-feedback feedback-revelado';
    feedbackEl.innerHTML = formatarFormula(msg);

    emitirEventoQuiz({
      acertou: false,
      tentativa: Math.max(2, tentativas),
      revelado: true,
      indiceEscolhido,
      desafio: quiz,
      mensagemFeedback: quiz.explicacao || textoCorreta
    });
  };

  quiz.opcoes.forEach((textoOpcao, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lousa-quiz-opcao';
    btn.setAttribute('data-indice', String(idx));
    btn.setAttribute('aria-pressed', 'false');

    const letraSpan = document.createElement('span');
    letraSpan.className = 'lousa-quiz-letra';
    letraSpan.textContent = LETRAS_ALTERNATIVAS[idx] || String(idx + 1);

    const textoSpan = document.createElement('span');
    textoSpan.className = 'lousa-quiz-texto';
    textoSpan.innerHTML = formatarFormula(String(textoOpcao));

    btn.appendChild(letraSpan);
    btn.appendChild(textoSpan);

    btn.addEventListener('click', () => {
      if (encerrado || btn.disabled) return;
      tentativas++;
      btn.setAttribute('aria-pressed', 'true');

      if (idx === indiceCorreto) {
        btn.classList.add('correta');
        finalizarCard();
        const msg = `🎉 Muito bem! ${quiz.explicacao || ''}`.trim();
        feedbackEl.className = 'lousa-quiz-feedback feedback-correto';
        feedbackEl.innerHTML = formatarFormula(msg);

        emitirEventoQuiz({
          acertou: true,
          tentativa: tentativas,
          indiceEscolhido: idx,
          desafio: quiz,
          mensagemFeedback: quiz.explicacao || 'Você acertou!'
        });
        return;
      }

      btn.classList.add('incorreta');
      btn.disabled = true;

      if (tentativas === 1) {
        const textoDica = quiz.dica?.trim() || 'Releia o enunciado com atenção e tente novamente!';
        feedbackEl.className = 'lousa-quiz-feedback feedback-dica';
        feedbackEl.innerHTML = formatarFormula(`💡 Dica: ${textoDica}`);

        emitirEventoQuiz({
          acertou: false,
          tentativa: 1,
          indiceEscolhido: idx,
          desafio: quiz,
          mensagemFeedback: textoDica
        });
      } else {
        revelarRespostaCompleta(idx);
      }
    });

    botoesOpcao.push(btn);
    opcoesWrap.appendChild(btn);
  });

  btnVerResposta.addEventListener('click', () => {
    if (encerrado) return;
    tentativas = Math.max(2, tentativas + 1);
    revelarRespostaCompleta(indiceCorreto);
  });

  card.appendChild(opcoesWrap);
  card.appendChild(feedbackEl);
  card.appendChild(acoesEl);
  return card;
}

export function renderizarItemLousa(
  item: ItemLousa,
  onCliqueImagem?: (url: string, legenda?: string) => void,
  onResponderQuiz?: OnResponderQuizCallback
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
        const textoSemPrefixo = String(p).replace(/^\s*\d+[\.\)\-]\s*/, '');
        li.innerHTML = `<span class="passo-numero">${idx + 1}</span><div class="passo-corpo">${formatarFormula(
          textoSemPrefixo
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
      if (!Array.isArray(cabecalho) || !Array.isArray(tab.linhas)) return null;
      (cabecalho as unknown[]).forEach(col => {
        const th = document.createElement('th');
        th.textContent = col === null || col === undefined ? '' : String(col);
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);

      // Tbody
      const tbody = document.createElement('tbody');
      (tab.linhas as unknown[]).forEach(linha => {
        if (!Array.isArray(linha)) return;
        const tr = document.createElement('tr');
        linha.forEach(celula => {
          const td = document.createElement('td');
          td.innerHTML = formatarFormula(celula === null || celula === undefined ? '' : String(celula));
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

    case 'quiz': {
      const cardQuiz = montarCardQuiz(item.conteudo as DesafioQuiz, onResponderQuiz);
      if (!cardQuiz) return null;
      container.appendChild(cardQuiz);
      break;
    }

    case 'grafico': {
      const graficoEl = montarGraficoCartesiano(item.conteudo as GraficoConteudo, item.legenda);
      if (!graficoEl) return null;
      container.appendChild(graficoEl);
      break;
    }

    default:
      return null;
  }

  return container;
}
