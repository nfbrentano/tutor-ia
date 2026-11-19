import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GerenciadorCaderno } from '../src/caderno';
import { ChatGerenciador } from '../src/chat';
import {
  calcularDimensoesRedimensionadas,
  callGeminiApi,
  limparCacheModelos,
  parseGeminiResponse,
  prepararImagemParaEnvio,
  validarArquivoImagem
} from '../src/gemini';
import { DesafioQuiz, LousaControlador, renderizarItemLousa } from '../src/lousa';
import { configurarFechamentoModaisEscape } from '../src/tutor';

const desafioExemplo: DesafioQuiz = {
  pergunta: 'Quanto vale x em 2x + 4 = 10?',
  opcoes: ['x = 2', 'x = 3', 'x = 5', 'x = 7'],
  correta: 1,
  dica: 'Subtraia 4 dos dois lados primeiro: 2x = 6.',
  explicacao: 'Isolando 2x = 6 e dividindo por 2, encontramos x = 3.'
};

describe('Modo Prática Interativa, Socrático por Foto e Caderno de Estudos', () => {
  beforeEach(() => {
    limparCacheModelos();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('CT01: parseGeminiResponse extrai desafio e renderizarItemLousa renderiza quiz acessível (CA01, RNF03)', () => {
    const jsonBruto = JSON.stringify({
      materia: 'matematica',
      etapas: [
        {
          fala: 'Vamos isolar o x passo a passo.',
          lousa: { tipo: 'formula', conteudo: '2x + 4 = 10' }
        }
      ],
      desafio: desafioExemplo
    });

    const resposta = parseGeminiResponse(jsonBruto);
    expect(resposta.desafio).toEqual(desafioExemplo);

    const el = renderizarItemLousa({ tipo: 'quiz', conteudo: resposta.desafio! });
    expect(el).not.toBeNull();

    const botoes = el!.querySelectorAll<HTMLButtonElement>('button.lousa-quiz-opcao');
    expect(botoes.length).toBe(4);
    botoes.forEach((btn) => {
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });

    const regiaoLive = el!.querySelector('.lousa-quiz-feedback');
    expect(regiaoLive?.getAttribute('aria-live')).toBe('polite');
  });

  it('CT02: clicar na alternativa correta na 1ª tentativa aplica .correta e aciona callback de acerto com explicacao (CA02)', () => {
    const onResponder = vi.fn();
    const el = renderizarItemLousa({ tipo: 'quiz', conteudo: desafioExemplo }, undefined, onResponder);
    expect(el).not.toBeNull();

    const botoes = el!.querySelectorAll<HTMLButtonElement>('button.lousa-quiz-opcao');
    botoes[1].click(); // x = 3 (correta: 1)

    expect(botoes[1].classList.contains('correta')).toBe(true);
    expect(botoes[1].getAttribute('aria-pressed')).toBe('true');
    expect(el!.querySelector('.lousa-quiz-feedback')?.textContent).toContain(desafioExemplo.explicacao);
    expect(onResponder).toHaveBeenCalledTimes(1);
    expect(onResponder.mock.calls[0][0]).toMatchObject({
      acertou: true,
      tentativa: 1,
      indiceEscolhido: 1,
      desafio: desafioExemplo
    });
  });

  it('CT03: 1ª tentativa errada exibe dica sem mostrar .correta; 2ª tentativa errada (e Ver resposta) revela correta e explicacao (CA03, CA04)', async () => {
    const onResponder = vi.fn();
    const el = renderizarItemLousa({ tipo: 'quiz', conteudo: desafioExemplo }, undefined, onResponder);
    const botoes = el!.querySelectorAll<HTMLButtonElement>('button.lousa-quiz-opcao');

    // 1º erro: alternativa A (índice 0)
    botoes[0].click();
    expect(botoes[0].classList.contains('incorreta')).toBe(true);
    expect(botoes[1].classList.contains('correta')).toBe(false);
    expect(el!.querySelectorAll('.lousa-quiz-opcao.correta').length).toBe(0);
    expect(el!.querySelector('.lousa-quiz-feedback')?.textContent).toContain(desafioExemplo.dica);
    expect(onResponder.mock.calls[0][0]).toMatchObject({
      acertou: false,
      tentativa: 1
    });

    // 2º erro: alternativa C (índice 2)
    botoes[2].click();
    expect(botoes[2].classList.contains('incorreta')).toBe(true);
    expect(botoes[1].classList.contains('correta')).toBe(true);
    expect(el!.querySelector('.lousa-quiz-feedback')?.textContent).toContain(desafioExemplo.explicacao);
    expect(onResponder.mock.calls[1][0]).toMatchObject({
      acertou: false,
      tentativa: 2,
      revelado: true
    });

    // Fluxo alternativo: botão "Ver resposta" após 1º erro
    const onVerResp = vi.fn();
    const elVer = renderizarItemLousa({ tipo: 'quiz', conteudo: desafioExemplo }, undefined, onVerResp);
    elVer!.querySelectorAll<HTMLButtonElement>('button.lousa-quiz-opcao')[0].click();
    elVer!.querySelector<HTMLButtonElement>('button.lousa-quiz-ver-resposta')!.click();
    expect(elVer!.querySelectorAll<HTMLButtonElement>('button.lousa-quiz-opcao')[1].classList.contains('correta')).toBe(true);
    expect(onVerResp).toHaveBeenLastCalledWith(expect.objectContaining({ revelado: true }));

    // Resposta por voz na LousaControlador
    const painel = document.createElement('div');
    const corpo = document.createElement('div');
    const onQuizCtrl = vi.fn();
    const lousa = new LousaControlador({ painelElemento: painel, corpoElemento: corpo }, undefined, onQuizCtrl);
    await lousa.abrirDesafioQuiz(desafioExemplo);
    const acertouVoz = lousa.responderQuizAtivoPorVoz('letra B');
    expect(acertouVoz).toBe(true);
    expect(onQuizCtrl).toHaveBeenCalledWith(expect.objectContaining({ acertou: true, indiceEscolhido: 1 }));
  });

  it('CT04: callGeminiApi com modoPedagogico "dica" inclui instrução socrática no payload (CA05)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    materia: 'matematica',
                    etapas: [{ fala: 'Qual operação inversa devemos aplicar ao +4?', lousa: { tipo: 'passos', conteudo: ['Isolar o termo 2x'] } }]
                  })
                }
              ]
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiApi('Como resolver 2x + 4 = 10?', 'fake-key-123', {
      modoPedagogico: 'dica',
      customModels: ['gemini-3.5-flash-lite']
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const bodyEnviado = JSON.parse(fetchMock.mock.calls[0][1].body);
    const textoUser = bodyEnviado.contents[0].parts[0].text;
    const textoSystem = bodyEnviado.systemInstruction.parts[0].text;
    expect(textoUser).toContain('MODO DICA SOCRÁTICA');
    expect(textoSystem).toContain('NÃO entregue o resultado final');
  });

  it('CT05: prepararImagemParaEnvio e callGeminiApi enviam inlineData junto com o texto respeitando redimensionamento (CA06, RNF02)', async () => {
    const dims = calcularDimensoesRedimensionadas(2560, 1920, 1280);
    expect(dims).toEqual({ largura: 1280, altura: 960 });

    const blobSimulado = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'exercicio.jpg', {
      type: 'image/jpeg'
    });
    const imagemPreparada = await prepararImagemParaEnvio(blobSimulado);
    expect(imagemPreparada.mimeType).toBe('image/jpeg');
    expect(imagemPreparada.data.length).toBeGreaterThan(0);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    materia: 'matematica',
                    etapas: [{ fala: 'Vi o exercício na foto!', lousa: null }]
                  })
                }
              ]
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiApi('Me ajuda com essa questão da foto', 'fake-key-123', {
      imagem: imagemPreparada,
      customModels: ['gemini-3.5-flash-lite']
    });

    const bodyEnviado = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(bodyEnviado.contents[0].parts).toHaveLength(2);
    expect(bodyEnviado.contents[0].parts[1]).toEqual({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imagemPreparada.data
      }
    });
  });

  it('CT06: valida e recusa arquivos não-imagem (.pdf/.exe) e imagens > 10 MB com erro amigável sem chamar fetch (CA07, RNF02)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const pdfFake = new File(['%PDF-1.4'], 'apostila.pdf', { type: 'application/pdf' });
    const resPdf = validarArquivoImagem(pdfFake);
    expect(resPdf.valido).toBe(false);
    expect(resPdf.erro).toContain('Formato não suportado');
    await expect(prepararImagemParaEnvio(pdfFake)).rejects.toThrow(/Formato não suportado/);

    const exeFake = new File(['MZ'], 'programa.exe', { type: '' });
    expect(validarArquivoImagem(exeFake).valido).toBe(false);

    const arquivoGrande = { type: 'image/png', size: 11 * 1024 * 1024, name: 'gigante.png' };
    const resGrande = validarArquivoImagem(arquivoGrande);
    expect(resGrande.valido).toBe(false);
    expect(resGrande.erro).toContain('10 MB');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CT07: GerenciadorCaderno salva, lista, filtra por matéria, exclui anotações e contabiliza sessão (RF05, RF06, CA08)', async () => {
    const caderno = new GerenciadorCaderno();

    const notaMat = await caderno.salvarNota({
      pergunta: 'Como resolver 2x + 4 = 10?',
      materia: 'matematica',
      personaId: 'ada',
      personaNome: 'Ada',
      textoCompleto: 'Subtraia 4 e divida por 2.',
      itensLousa: [{ tipo: 'formula', conteudo: 'x = 3' }]
    });

    const notaHist = await caderno.salvarNota({
      pergunta: 'O que foi a Revolução Francesa?',
      materia: 'historia',
      personaId: 'herodoto',
      personaNome: 'Heródoto',
      textoCompleto: 'Movimento de 1789 na França.',
      itensLousa: [{ tipo: 'texto', conteudo: 'Queda da Bastilha (1789)' }]
    });

    const todas = await caderno.listarNotas();
    expect(todas).toHaveLength(2);

    const apenasMat = await caderno.listarNotas('matematica');
    expect(apenasMat).toHaveLength(1);
    expect(apenasMat[0].id).toBe(notaMat.id);

    const apenasHist = await caderno.listarNotas('historia');
    expect(apenasHist).toHaveLength(1);
    expect(apenasHist[0].id).toBe(notaHist.id);

    const removida = await caderno.excluirNota(notaMat.id);
    expect(removida).toBe(true);
    expect(await caderno.listarNotas()).toHaveLength(1);

    caderno.registrarDuvidaRespondida();
    caderno.registrarDesafioConcluido(true);
    caderno.registrarDesafioConcluido(false);
    expect(caderno.obterEstatisticasSessao()).toEqual({
      duvidasRespondidas: 1,
      desafiosConcluidos: 2,
      desafiosAcertados: 1
    });
  });

  it('CT08: reabrir item salvo do Caderno offline carrega Lousa em <= 200 ms e integra botões do Chat e Escape (CA08, CA09, RNF04)', async () => {
    const caderno = new GerenciadorCaderno();
    const nota = await caderno.salvarNota({
      pergunta: 'Qual a fórmula da água?',
      materia: 'fisica_quimica',
      personaId: 'prof-atomo',
      personaNome: 'Prof. Átomo',
      textoCompleto: 'A água é formada por dois átomos de hidrogênio e um de oxigênio.',
      itensLousa: [
        { tipo: 'formula', conteudo: 'H_2O' },
        { tipo: 'lista', conteudo: ['2 Hidrogênios', '1 Oxigênio'] }
      ],
      desafio: desafioExemplo
    });

    // Offline: se houver tentativa de rede, falha
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    const painel = document.createElement('div');
    const corpo = document.createElement('div');
    const lousa = new LousaControlador({ painelElemento: painel, corpoElemento: corpo });

    const inicio = performance.now();
    const notaCarregada = await caderno.obterNota(nota.id);
    expect(notaCarregada).not.toBeNull();
    await lousa.carregarItens(notaCarregada!.itensLousa);
    const duracaoMs = performance.now() - inicio;

    expect(duracaoMs).toBeLessThanOrEqual(200);
    expect(lousa.estaAberta()).toBe(true);
    expect(lousa.obterItensAtuais()).toHaveLength(2);
    expect(corpo.querySelector('.lousa-conteudo-formula')?.innerHTML).toContain('H<sub>2</sub>O');

    // ChatGerenciador: botões "🎯 Testar se entendi" e "⭐ Salvar no Caderno" -> "✓ Salvo no Caderno"
    const chatContainer = document.createElement('div');
    const onIniciarDesafio = vi.fn();
    const onSalvarCaderno = vi.fn().mockResolvedValue(undefined);
    const chat = new ChatGerenciador(chatContainer, (itens) => {
      void lousa.carregarItens(itens);
    });
    chat.definirOnIniciarDesafio(onIniciarDesafio);
    chat.definirOnSalvarNoCaderno(onSalvarCaderno);

    chat.adicionarMensagem('tutor', 'Explicação completa.', nota.itensLousa, null, null, {
      desafio: desafioExemplo,
      perguntaOriginal: nota.pergunta,
      materia: nota.materia
    });

    const btnQuiz = chatContainer.querySelector<HTMLButtonElement>('.bubble-quiz-btn');
    expect(btnQuiz?.textContent).toContain('Testar se entendi');
    btnQuiz?.click();
    expect(onIniciarDesafio).toHaveBeenCalledWith(desafioExemplo);

    const btnSalvar = chatContainer.querySelector<HTMLButtonElement>('.btn-salvar-caderno');
    expect(btnSalvar?.textContent).toContain('Salvar no Caderno');
    btnSalvar?.click();
    await Promise.resolve();
    expect(onSalvarCaderno).toHaveBeenCalledTimes(1);
    expect(btnSalvar?.textContent).toContain('Salvo no Caderno');
    expect(btnSalvar?.classList.contains('salvo')).toBe(true);

    // Escape fecha modal do Caderno
    const modalCaderno = document.createElement('div');
    const desvincular = configurarFechamentoModaisEscape(null, null, undefined, modalCaderno);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modalCaderno.classList.contains('hidden')).toBe(true);
    desvincular();
  });
});
