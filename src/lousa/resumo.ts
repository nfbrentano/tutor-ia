/**
 * TUTORIA - Formatador e Exportador do Resumo da Lousa (RF06b, CA10, CT09)
 */

import { DesafioQuiz, GraficoConteudo, ImagemConteudo, ItemLousa, TabelaConteudo } from './tipos';

function limparTextoFormulaResumo(raw: string): string {
  return (raw || '')
    .replace(/\$\$?/g, '')
    .replace(/\\(?:left|right)(?![a-zA-Z])/g, '')
    .trim();
}

/**
 * Converte a lista de itens da lousa em resumo organizado em Markdown/texto puro
 * para cópia na área de transferência ou download em `.md` (RF06b, CA10, CT09).
 */
export function formatarResumoLousa(itens: ItemLousa[], titulo = 'Resumo da Lousa - TutorIA'): string {
  if (!Array.isArray(itens) || itens.length === 0) {
    return `# ${titulo}\n\n(Nenhum item exibido na lousa até o momento.)`;
  }

  const blocos: string[] = [`# ${titulo}`];

  for (const item of itens) {
    if (!item) continue;

    switch (item.tipo) {
      case 'texto': {
        const texto = typeof item.conteudo === 'string' ? item.conteudo.trim() : '';
        if (texto) blocos.push(texto);
        break;
      }

      case 'formula': {
        const formula = typeof item.conteudo === 'string' ? limparTextoFormulaResumo(item.conteudo) : '';
        if (formula) blocos.push(`**Fórmula:** \`${formula}\``);
        break;
      }

      case 'passos': {
        const passos = Array.isArray(item.conteudo) ? item.conteudo : [String(item.conteudo)];
        const linhas = passos
          .map((p, idx) => {
            const semPrefixo = String(p).replace(/^\s*\d+[\.\)\-]\s*/, '').trim();
            return `${idx + 1}. ${limparTextoFormulaResumo(semPrefixo)}`;
          })
          .filter(Boolean);
        if (linhas.length > 0) blocos.push(linhas.join('\n'));
        break;
      }

      case 'lista': {
        const topicos = Array.isArray(item.conteudo) ? item.conteudo : [String(item.conteudo)];
        const linhas = topicos
          .map((t) => `- ${limparTextoFormulaResumo(String(t))}`)
          .filter((l) => l.length > 2);
        if (linhas.length > 0) blocos.push(linhas.join('\n'));
        break;
      }

      case 'tabela': {
        const tab = item.conteudo as TabelaConteudo & { colunas?: string[] };
        const cabecalho = tab?.cabecalho || tab?.colunas;
        if (!Array.isArray(cabecalho) || !Array.isArray(tab?.linhas)) break;
        const header = `| ${cabecalho.map((c) => String(c).trim()).join(' | ')} |`;
        const sep = `| ${cabecalho.map(() => '---').join(' | ')} |`;
        const rows = tab.linhas.map((l) => `| ${l.map((c) => limparTextoFormulaResumo(String(c))).join(' | ')} |`);
        blocos.push([header, sep, ...rows].join('\n'));
        break;
      }

      case 'grafico': {
        const g = item.conteudo as GraficoConteudo;
        const partes: string[] = [];
        if (g?.titulo) partes.push(`**Gráfico:** ${g.titulo}`);
        if (g?.expressao) partes.push(`Expressão: \`${limparTextoFormulaResumo(g.expressao)}\``);
        if (Array.isArray(g?.pontos) && g.pontos.length > 0) {
          const pontosStr = g.pontos
            .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
            .map((p) => `(${p.x}, ${p.y})`)
            .join(', ');
          if (pontosStr) partes.push(`Pontos: ${pontosStr}`);
        }
        if (partes.length > 0) blocos.push(partes.join('\n'));
        break;
      }

      case 'imagem': {
        const img = item.conteudo as ImagemConteudo;
        const leg = img?.legenda || item.legenda || img?.termo;
        if (leg) blocos.push(`🖼️ *Ilustração:* ${leg}`);
        break;
      }

      case 'desenho': {
        if (item.legenda) blocos.push(`✏️ *Diagrama:* ${item.legenda}`);
        break;
      }

      case 'quiz': {
        const q = item.conteudo as DesafioQuiz;
        if (q?.pergunta) {
          const letras = ['A', 'B', 'C', 'D', 'E'];
          const opts = Array.isArray(q.opcoes)
            ? q.opcoes.map((o, i) => `  - ${letras[i] || i + 1}) ${limparTextoFormulaResumo(o)}`).join('\n')
            : '';
          blocos.push(`🎯 **Desafio:** ${limparTextoFormulaResumo(q.pergunta)}${opts ? '\n' + opts : ''}`);
        }
        break;
      }
    }
  }

  return blocos.join('\n\n');
}
