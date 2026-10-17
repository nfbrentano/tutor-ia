/**
 * Gerador de PDFs mínimos válidos para testes e fixtures da Base de Conhecimento
 */

import * as fs from 'fs';
import * as path from 'path';

export function gerarPdfMultiPaginas(paginasLinhas: string[][]): Buffer {
  let output = '%PDF-1.4\n';
  const offsets: number[] = [0];

  const numPaginas = paginasLinhas.length;
  const pageObjIds: number[] = [];

  // Objeto 1: Catalog
  // Objeto 2: Pages
  // Objeto 3: Font
  // Páginas começam no obj 4
  const fontObjId = 3;
  let nextObjId = 4;

  for (let i = 0; i < numPaginas; i++) {
    pageObjIds.push(nextObjId);
    nextObjId += 2; // cada página tem o Page obj e o Contents obj
  }

  // Obj 1: Catalog
  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  offsets.push(Buffer.byteLength(output));
  output += obj1;

  // Obj 2: Pages
  const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${numPaginas} >>\nendobj\n`;
  offsets.push(Buffer.byteLength(output));
  output += obj2;

  // Obj 3: Font
  const obj3 = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  offsets.push(Buffer.byteLength(output));
  output += obj3;

  for (let i = 0; i < numPaginas; i++) {
    const pageId = pageObjIds[i];
    const contentsId = pageId + 1;
    const linhas = paginasLinhas[i];

    let contentStream = '';
    if (linhas.length > 0) {
      contentStream =
        'BT\n/F1 12 Tf\n50 720 Td\n' +
        linhas.map(l => `(${l.replace(/[()\\\\]/g, '')}) Tj\n0 -18 Td\n`).join('') +
        'ET';
    }

    const streamLen = Buffer.byteLength(contentStream);

    // Page Object
    const pageObj = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentsId} 0 R >>\nendobj\n`;
    offsets.push(Buffer.byteLength(output));
    output += pageObj;

    // Contents Object
    const contentsObj = `${contentsId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
    offsets.push(Buffer.byteLength(output));
    output += contentsObj;
  }

  const startXref = Buffer.byteLength(output);
  const totalObjs = nextObjId;

  const pad = (n: number) => String(n).padStart(10, '0') + ' 00000 n \n';
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (let i = 1; i < totalObjs; i++) {
    xref += pad(offsets[i]);
  }

  const trailer = `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  output += xref + trailer;

  return Buffer.from(output, 'latin1');
}

export function gerarFixturesEmDisco(): void {
  const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
  const livrosDir = path.resolve(process.cwd(), 'livros');

  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.mkdirSync(livrosDir, { recursive: true });

  // 1. Livro de Ciências
  const cienciasPaginas: string[][] = [
    [
      'Capitulo 1: A Fotossintese e os Vegetais',
      'A fotossintese e o processo biologico vital realizado pelas plantas e algas clorofiladas.',
      'Durante a fotossintese, a clorofila captura a energia luminosa do Sol nos cloroplastos.',
      'A agua absorvida pelas raizes e o gas carbonico absorvido pelas folhas sao convertidos em glicose.',
      'Como subproduto essencial da fotossintese, o oxigenio e liberado na atmosfera para a respiracao.',
      'A equacao quimica basica da fotossintese pode ser resumida na sintese de carboidratos com luz solar.',
      'As celulas vegetais dependem dos cloroplastos e da luz para produzir seu proprio alimento energetico.'
    ],
    [
      'Capitulo 2: A Celula e suas Organelas',
      'A celula e a menor unidade estrutural e funcional de todos os seres vivos.',
      'Nas celulas eucariontes encontramos o nucleo que abriga o material genetico com o DNA.',
      'A membrana plasmatica controla a entrada e saida de substancias e nutrientes na celula.',
      'O citoplasma abriga diversas organelas fundamentais como as mitocondrias, que geram energia (ATP).',
      'Os ribossomos sao responsaveis pela sintese das proteinas necessarias ao organismo celular.',
      'O complexo golgiense e o reticulo endoplasmatico atuam no transporte e modificacao de proteinas.'
    ],
    [
      'Capitulo 3: Ecologia e Cadeias Alimentares',
      'Os ecossistemas sao formados pela interacao entre fatores bioticos (vivos) e abioticos.',
      'Os organismos produtores sao a base da cadeia alimentar, gerando biomassa por fotossintese.',
      'Consumidores primarios alimentam-se de plantas, enquanto os decompositores reciclam a materia organica.'
    ]
  ];

  const bufferCiencias = gerarPdfMultiPaginas(cienciasPaginas);
  fs.writeFileSync(path.join(fixturesDir, 'livro-ciencias-exemplo.pdf'), bufferCiencias);
  fs.writeFileSync(path.join(livrosDir, 'ciencias-6ano.pdf'), bufferCiencias);

  // 2. Livro de História
  const historiaPaginas: string[][] = [
    [
      'Capitulo 1: A Revolucao Francesa de 1789',
      'A Revolucao Francesa foi um marco historico fundamental que transformou a Europa moderna.',
      'A insatisfacao popular contra os privilegios da nobreza e do clero culminou na Queda da Bastilha.',
      'Os principios iluministas de Liberdade, Igualdade e Fraternidade inspiraram a Declaracao dos Direitos do Homem.',
      'O fim do Antigo Regime na Franca abriu caminho para a consolidacao dos regimes democraticos e republicanos.'
    ],
    [
      'Capitulo 2: O Brasil Colonial e o Ciclo do Ouro',
      'No seculo XVIII, a descoberta de jazidas de ouro em Minas Gerais alterou a economia da colonia brasileira.',
      'A cobranca de impostos pela coroa portuguesa, como o quinto e a derrama, gerou revoltas como a Inconfidencia Mineira.'
    ]
  ];

  const bufferHistoria = gerarPdfMultiPaginas(historiaPaginas);
  fs.writeFileSync(path.join(fixturesDir, 'livro-historia-exemplo.pdf'), bufferHistoria);
  fs.writeFileSync(path.join(livrosDir, 'historia-7ano.pdf'), bufferHistoria);

  // 3. Livro de Matemática
  const matematicaPaginas: string[][] = [
    [
      'Capitulo 1: Fracoes e Operacoes Fundamentais',
      'Uma fracao representa uma ou mais partes iguais em que uma unidade ou totalidade foi dividida.',
      'O numerador indica quantas partes foram consideradas, enquanto o denominador indica o total de partes.',
      'Para somar fracoes com denominadores diferentes, calcula-se o minimo multiplo comum (MMC).'
    ]
  ];

  const bufferMatematica = gerarPdfMultiPaginas(matematicaPaginas);
  fs.writeFileSync(path.join(fixturesDir, 'livro-matematica-exemplo.pdf'), bufferMatematica);
  fs.writeFileSync(path.join(livrosDir, 'matematica-6ano.pdf'), bufferMatematica);

  // 4. PDF escaneado (páginas sem texto / apenas stream vazio - CA03)
  const bufferEscaneado = gerarPdfMultiPaginas([[], []]);
  fs.writeFileSync(path.join(fixturesDir, 'livro-escaneado.pdf'), bufferEscaneado);

  // 5. PDF corrompido (bytes inválidos - CA03)
  const bufferCorrompido = Buffer.from('ESTE_NAO_E_UM_ARQUIVO_PDF_VALIDO_CORROMPIDO_12345');
  fs.writeFileSync(path.join(fixturesDir, 'livro-corrompido.pdf'), bufferCorrompido);
}
