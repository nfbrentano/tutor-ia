/**
 * TUTORIA - Script de Indexação Prévia de Livros Didáticos em PDF
 * (RF02, RF03, CA01, CA02, CA03, RNF03, RNF04)
 * Uso: npm run indexar-livros
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { construirIndiceInvertido, dividirEmTrechos } from '../src/conhecimento/indexador';
import { LivroCatalogo, TrechoLivro } from '../src/conhecimento/tipos';

const CAMINHO_CATALOGO = path.resolve(process.cwd(), 'livros/catalogo.json');
const DIR_SAIDA = path.resolve(process.cwd(), 'public/conhecimento');
const CAMINHO_INDICE = path.join(DIR_SAIDA, 'indice.json');

interface RelatorioIndexacao {
  livrosProcessados: number;
  livrosComErro: string[];
  totalPaginas: number;
  totalTrechos: number;
  paginasSemTexto: Array<{ livro: string; pagina: number }>;
  tamanhoBytes: number;
  tamanhoGzipBytes: number;
}

export async function executarIndexacao(opcoes: { catalogoPath?: string; saidaPath?: string } = {}): Promise<RelatorioIndexacao> {
  const catalogoPath = opcoes.catalogoPath || CAMINHO_CATALOGO;
  const saidaPath = opcoes.saidaPath || CAMINHO_INDICE;

  console.log('\n======================================================');
  console.log('  TutorIA - Indexação de Livros Didáticos (RAG Local)');
  console.log('======================================================\n');

  if (!fs.existsSync(catalogoPath)) {
    console.warn(`[AVISO] Catálogo não encontrado em ${catalogoPath}. Criando catálogo vazio.`);
    fs.mkdirSync(path.dirname(catalogoPath), { recursive: true });
    fs.writeFileSync(catalogoPath, JSON.stringify([], null, 2), 'utf-8');
  }

  const catalogoConteudo = fs.readFileSync(catalogoPath, 'utf-8');
  let livros: LivroCatalogo[] = [];
  try {
    livros = JSON.parse(catalogoConteudo);
  } catch (e: any) {
    console.error(`[ERRO] Falha ao ler JSON do catálogo: ${e.message}`);
    process.exit(1);
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const todosTrechos: TrechoLivro[] = [];
  const relatorio: RelatorioIndexacao = {
    livrosProcessados: 0,
    livrosComErro: [],
    totalPaginas: 0,
    totalTrechos: 0,
    paginasSemTexto: [],
    tamanhoBytes: 0,
    tamanhoGzipBytes: 0
  };

  const livrosIndexadosSucesso: LivroCatalogo[] = [];

  for (const livro of livros) {
    console.log(`\n📚 Processando livro: "${livro.titulo}" (${livro.disciplina} - ${livro.serie})`);
    console.log(`   ID: ${livro.id} | Licença: ${livro.licenca}`);

    // RNF04: Alerta sobre direitos autorais se licença restrita
    if (livro.licenca === 'restrita') {
      console.log(`   [RNF04] Livro com licença restrita - assegure que não seja commitado nem empacotado em produção.`);
    }

    const caminhoArquivo = path.resolve(process.cwd(), livro.arquivo);
    if (!fs.existsSync(caminhoArquivo)) {
      console.warn(`   ⚠️ Arquivo PDF não encontrado em: ${caminhoArquivo} (pulando)`);
      continue;
    }

    try {
      const buffer = fs.readFileSync(caminhoArquivo);
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const numPaginas = doc.numPages;
      relatorio.totalPaginas += numPaginas;

      console.log(`   Páginas detectadas: ${numPaginas}`);
      let trechosLivro = 0;
      let capituloAtual = 'Introdução';

      for (let p = 1; p <= numPaginas; p++) {
        try {
          const page = await doc.getPage(p);
          const textContent = await page.getTextContent();
          const items = (textContent.items || []) as any[];
          const linhas: string[] = [];
          let linhaBuffer = '';

          for (const item of items) {
            if (item.hasEOL) {
              linhaBuffer += item.str;
              linhas.push(linhaBuffer);
              linhaBuffer = '';
            } else {
              linhaBuffer += (linhaBuffer ? ' ' : '') + item.str;
            }
          }
          if (linhaBuffer) {
            linhas.push(linhaBuffer);
          }

          const textoPagina = linhas.join('\n').trim();

          // Detecção de páginas sem texto selecionável (CA03)
          if (!textoPagina || textoPagina.length < 30) {
            relatorio.paginasSemTexto.push({ livro: livro.titulo, pagina: p });
            continue;
          }

          // Detecção simples de capítulos por cabeçalhos
          for (const l of linhas) {
            const linhaLimpa = l.trim();
            if (/^(cap[ií]tulo|unidade|se[cç][aã]o|tema)\s+\d+/i.test(linhaLimpa)) {
              capituloAtual = linhaLimpa.slice(0, 60);
              break;
            }
          }

          // Divisão em trechos com parágrafos e sobreposição de 150 caracteres (RF02)
          const trechosPagina = dividirEmTrechos(textoPagina, {
            livroId: livro.id,
            tituloLivro: livro.titulo,
            disciplina: livro.disciplina,
            pagina: p,
            capitulo: capituloAtual
          });

          todosTrechos.push(...trechosPagina);
          trechosLivro += trechosPagina.length;
        } catch (pageErr: any) {
          console.warn(`   ⚠️ Erro ao extrair texto da página ${p}: ${pageErr.message}`);
          relatorio.paginasSemTexto.push({ livro: livro.titulo, pagina: p });
        }
      }

      if (trechosLivro > 0) {
        console.log(`   ✅ Extraídos ${trechosLivro} trechos desta obra.`);
        relatorio.totalTrechos += trechosLivro;
        relatorio.livrosProcessados++;
        livrosIndexadosSucesso.push(livro);
      } else {
        console.warn(`   ⚠️ Nenhuma página com texto selecionável encontrada em "${livro.titulo}".`);
      }
    } catch (docErr: any) {
      // CA03: Erro em PDF escaneado/corrompido é relatado e o script continua com os outros livros
      console.error(`   ❌ Falha ao processar arquivo "${caminhoArquivo}": ${docErr.message}`);
      relatorio.livrosComErro.push(`${livro.titulo} (${livro.arquivo})`);
    }
  }

  // Se nenhum PDF físico estava disponível no momento, cria estrutura base para garantir funcionamento
  const indiceFinal = construirIndiceInvertido(todosTrechos, livrosIndexadosSucesso.length > 0 ? livrosIndexadosSucesso : livros);

  fs.mkdirSync(path.dirname(saidaPath), { recursive: true });
  const jsonConteudo = JSON.stringify(indiceFinal);
  fs.writeFileSync(saidaPath, jsonConteudo, 'utf-8');

  relatorio.tamanhoBytes = Buffer.byteLength(jsonConteudo);
  relatorio.tamanhoGzipBytes = zlib.gzipSync(Buffer.from(jsonConteudo)).length;

  // Relatório no terminal (RF03, CA03, RNF03)
  console.log('\n------------------------------------------------------');
  console.log('              RELATÓRIO DE INDEXAÇÃO                  ');
  console.log('------------------------------------------------------');
  console.log(`Livros processados com sucesso: ${relatorio.livrosProcessados} de ${livros.length}`);
  console.log(`Total de páginas lidas:        ${relatorio.totalPaginas}`);
  console.log(`Total de trechos gerados:      ${relatorio.totalTrechos}`);
  console.log(`Tamanho do índice gerado:      ${(relatorio.tamanhoBytes / 1024).toFixed(1)} KB (gzip: ${(relatorio.tamanhoGzipBytes / 1024).toFixed(1)} KB)`);

  if (relatorio.livrosComErro.length > 0) {
    console.log(`\n⚠️ Livros corrompidos ou com erro (${relatorio.livrosComErro.length}):`);
    relatorio.livrosComErro.forEach(e => console.log(`   - ${e}`));
  }

  if (relatorio.paginasSemTexto.length > 0) {
    console.log(`\n⚠️ Páginas sem texto selecionável (escaneadas/imagens) (${relatorio.paginasSemTexto.length}):`);
    relatorio.paginasSemTexto.slice(0, 10).forEach(p => console.log(`   - ${p.livro}, pág. ${p.pagina}`));
    if (relatorio.paginasSemTexto.length > 10) {
      console.log(`   ... e mais ${relatorio.paginasSemTexto.length - 10} página(s).`);
    }
  }

  // RNF03: Avisa se o índice ultrapassar 3 MB gzip por 300 páginas
  const limiteGzipBytes = 3 * 1024 * 1024;
  if (relatorio.tamanhoGzipBytes > limiteGzipBytes) {
    console.warn(`\n[AVISO RNF03] O índice comprimido ultrapassou 3 MB (${(relatorio.tamanhoGzipBytes / (1024 * 1024)).toFixed(2)} MB)!`);
  } else {
    console.log(`✅ [RNF03] Tamanho dentro do limite máximo de 3 MB gzip.`);
  }

  console.log(`\n📁 Arquivo salvo em: ${saidaPath}\n`);
  return relatorio;
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].endsWith('indexar-livros.ts')) {
  executarIndexacao().catch(err => {
    console.error('Erro fatal na indexação:', err);
    process.exit(1);
  });
}
