/**
 * TUTORIA - Página do Gravador de Gestos (gravador.html, só em `npm run dev`)
 * Spec: SDD/2026-10-23_gravador-de-gestos.md (RF01 - RF11, RF13)
 */

import * as THREE from 'three';
import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

import type { CategoriaClipe } from '../avatar3d/animacoes';
import { POSE_CUMPRIMENTAR, POSE_IDLE, POSE_THINKING, POSES_GESTOS_FALA, POSES_REPOUSO } from '../avatar3d/poses';
import { PoseVRM } from '../avatar3d/tipos';
import { obterModeloPersona, obterPersonaPadrao, PERSONAS } from '../personas';
import { montarClipe, nomeClipeValido, serializarClipe } from './clipe';
import { converterQuadro, MaoDetectada } from './conversor';
import { SuavizadorRotacoes, trechosDeFalha } from './filtro';
import { PreviaAvatar } from './previa';
import { ClipeVRMJson, OssoGravado, Quat, QuadroGravado, RotacoesQuadro } from './tipos';

const FPS_PROCESSAMENTO = 30;
const WASM = '/node_modules/@mediapipe/tasks-vision/wasm';
const MODELO_POSE =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
const MODELO_MAO =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const contagem = $<HTMLDivElement>('contagem');
const progresso = $<HTMLDivElement>('progresso');
const mensagem = $<HTMLDivElement>('mensagem');
const btnWebcam = $<HTMLButtonElement>('btn-webcam');
const btnGravar = $<HTMLButtonElement>('btn-gravar');
const btnParar = $<HTMLButtonElement>('btn-parar');
const btnProcessar = $<HTMLButtonElement>('btn-processar');
const btnCalibrar = $<HTMLButtonElement>('btn-calibrar');
const btnTocar = $<HTMLButtonElement>('btn-tocar');
const btnBaixar = $<HTMLButtonElement>('btn-baixar');
const btnSalvar = $<HTMLButtonElement>('btn-salvar');
const arquivoVideo = $<HTMLInputElement>('arquivo-video');
const chkEspelhar = $<HTMLInputElement>('chk-espelhar');
const rngSuavidade = $<HTMLInputElement>('rng-suavidade');
const rngInicio = $<HTMLInputElement>('rng-inicio');
const rngFim = $<HTMLInputElement>('rng-fim');
const selPersonaPrevia = $<HTMLSelectElement>('sel-persona-previa');

const previa = new PreviaAvatar($<HTMLCanvasElement>('canvas-avatar'));

let pose: PoseLandmarker | null = null;
let maos: HandLandmarker | null = null;
let stream: MediaStream | null = null;
let gravando = false;
let inicioGravacaoMs = 0;
let ultimoTempoVideo = -1;
let ultimoTimestampMs = 0;
let suavizador = new SuavizadorRotacoes(Number(rngSuavidade.value));
let cabecaNeutra: Quat | undefined;
let ultimaCabecaBruta: Quat | undefined;
let quadros: QuadroGravado[] = [];
let tocando: number | null = null;

function mostrarMensagem(texto: string, tipo: 'ok' | 'erro' | '' = ''): void {
  mensagem.textContent = texto;
  mensagem.className = tipo;
}

async function carregarMediaPipe(): Promise<void> {
  if (pose && maos) return;
  progresso.textContent = 'Carregando MediaPipe (primeira vez baixa os modelos)…';
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODELO_POSE, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1
  });
  maos = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODELO_MAO, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2
  });
  progresso.textContent = '';
}

/** Detecta e converte o quadro atual do vídeo; o timestamp precisa sempre crescer. */
function processarQuadroAtual(timestampMs: number, dt: number): { rotacoes: RotacoesQuadro; falha: boolean; baixaConfianca: boolean } {
  const ts = Math.max(timestampMs, ultimoTimestampMs + 1);
  ultimoTimestampMs = ts;
  const resPose = pose!.detectForVideo(video, ts);
  const resMaos = maos!.detectForVideo(video, ts);
  const listaMaos: MaoDetectada[] = resMaos.landmarks.map((imagem, i) => ({ imagem, mundo: resMaos.worldLandmarks[i] }));

  const resultado = converterQuadro(resPose.worldLandmarks[0], resPose.landmarks[0], listaMaos, {
    espelhar: chkEspelhar.checked,
    cabecaNeutra
  });
  if (resultado.cabecaBruta) ultimaCabecaBruta = resultado.cabecaBruta;
  const rotacoes = suavizador.filtrar(resultado.rotacoes, dt);
  return { rotacoes, falha: !resultado.corpoValido, baixaConfianca: resultado.baixaConfianca };
}

/* ==========================================================================
   WEBCAM (RF02a)
   ========================================================================== */
function pararCamera(): void {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  btnGravar.disabled = true;
}

async function usarWebcam(): Promise<void> {
  try {
    await carregarMediaPipe();
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
  } catch (err) {
    const negado = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    mostrarMensagem(
      negado
        ? 'A câmera foi bloqueada. Libere a permissão no navegador ou use a opção de vídeo.'
        : `Não foi possível abrir a câmera: ${(err as Error).message}`,
      'erro'
    );
    return;
  }
  video.removeAttribute('src');
  video.srcObject = stream;
  await video.play();
  btnGravar.disabled = false;
  suavizador = new SuavizadorRotacoes(Number(rngSuavidade.value));
  requestAnimationFrame(loopWebcam);
}

function loopWebcam(): void {
  if (!stream) return;
  requestAnimationFrame(loopWebcam);
  if (video.readyState < 2 || video.currentTime === ultimoTempoVideo) return;
  const dt = ultimoTempoVideo < 0 ? 1 / 30 : Math.max(1 / 120, video.currentTime - ultimoTempoVideo);
  ultimoTempoVideo = video.currentTime;

  const quadro = processarQuadroAtual(performance.now(), dt);
  previa.aplicarRotacoes(quadro.rotacoes);
  if (gravando) {
    quadros.push({ t: (performance.now() - inicioGravacaoMs) / 1000, ...quadro });
  }
}

async function gravar(): Promise<void> {
  btnGravar.disabled = true;
  contagem.style.display = 'flex';
  for (const n of [3, 2, 1]) {
    contagem.textContent = String(n);
    await new Promise(r => setTimeout(r, 1000));
  }
  contagem.style.display = 'none';
  quadros = [];
  inicioGravacaoMs = performance.now();
  gravando = true;
  btnParar.disabled = false;
}

function parar(): void {
  gravando = false;
  btnParar.disabled = true;
  btnGravar.disabled = !stream;
  finalizarQuadros();
}

/* ==========================================================================
   ARQUIVO DE VÍDEO (RF02b): quadro a quadro a 30 fps fixos
   ========================================================================== */
async function processarArquivo(): Promise<void> {
  await carregarMediaPipe();
  btnProcessar.disabled = true;
  suavizador = new SuavizadorRotacoes(Number(rngSuavidade.value));
  quadros = [];
  const duracao = video.duration;
  const passo = 1 / FPS_PROCESSAMENTO;

  for (let t = 0; t <= duracao; t += passo) {
    await new Promise<void>(resolve => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      video.currentTime = Math.min(t, duracao);
    });
    const quadro = processarQuadroAtual(Math.round(t * 1000), passo);
    quadros.push({ t, ...quadro });
    if (quadros.length % 3 === 0) {
      previa.aplicarRotacoes(quadro.rotacoes);
      progresso.textContent = `Processando ${t.toFixed(1)} / ${duracao.toFixed(1)} s`;
      await new Promise(r => requestAnimationFrame(r));
    }
  }
  progresso.textContent = `Pronto: ${quadros.length} quadros.`;
  btnProcessar.disabled = false;
  finalizarQuadros();
}

function selecionarArquivo(): void {
  const arquivo = arquivoVideo.files?.[0];
  if (!arquivo) return;
  pararCamera();
  video.srcObject = null;
  video.src = URL.createObjectURL(arquivo);
  video.load();
  btnProcessar.disabled = false;
  mostrarMensagem('');
}

/* ==========================================================================
   RECORTE, PRÉVIA DO CLIPE E SALVAR (RF07 - RF09)
   ========================================================================== */
function formatar(t: number): string {
  return `${t.toFixed(1).replace('.', ',')} s`;
}

function finalizarQuadros(): void {
  const duracao = quadros.length ? quadros[quadros.length - 1].t : 0;
  for (const rng of [rngInicio, rngFim]) rng.max = String(duracao);
  rngInicio.value = '0';
  rngFim.value = String(Math.min(duracao, 15));
  atualizarRecorte();

  const falhas = trechosDeFalha(quadros);
  const incertos = quadros.filter(q => q.baixaConfianca).length;
  const avisos: string[] = [];
  if (falhas.length) avisos.push(`Corpo não detectado em: ${falhas.map(([a, b]) => `${formatar(a)}–${formatar(b)}`).join(', ')}.`);
  if (incertos) avisos.push(`${incertos} quadro(s) com profundidade corrigida: revise o antebraço.`);
  $('falhas').textContent = avisos.join(' ');

  const temQuadros = quadros.length > 1;
  btnTocar.disabled = !temQuadros;
  btnBaixar.disabled = !temQuadros;
  btnSalvar.disabled = !temQuadros;
}

function atualizarRecorte(): void {
  if (Number(rngInicio.value) > Number(rngFim.value)) rngInicio.value = rngFim.value;
  $('txt-inicio').textContent = formatar(Number(rngInicio.value));
  $('txt-fim').textContent = formatar(Number(rngFim.value));
}

function personasSelecionadas(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('#lista-personas input:checked')).map(c => c.value);
}

function montar(): ClipeVRMJson {
  const nome = $<HTMLInputElement>('txt-nome').value.trim();
  if (!nomeClipeValido(nome)) throw new Error('Nome inválido: use letras minúsculas, números e hífens (ex.: explicando-1).');
  return montarClipe(quadros, Number(rngInicio.value), Number(rngFim.value), {
    nome,
    categoria: $<HTMLSelectElement>('sel-categoria').value as CategoriaClipe,
    loop: $<HTMLInputElement>('chk-loop').checked,
    loopSuave: $<HTMLInputElement>('chk-loop-suave').checked,
    personas: personasSelecionadas()
  });
}

/** Toca em loop exatamente o que será salvo (montarClipe), para revisar antes. */
function alternarTocar(): void {
  if (tocando !== null) {
    clearInterval(tocando);
    tocando = null;
    btnTocar.textContent = 'Tocar como clipe';
    return;
  }
  let clipe: ClipeVRMJson;
  try {
    const nome = $<HTMLInputElement>('txt-nome').value.trim() || 'previa';
    clipe = montarClipe(quadros, Number(rngInicio.value), Number(rngFim.value), {
      nome,
      categoria: 'speaking',
      loop: true,
      loopSuave: $<HTMLInputElement>('chk-loop-suave').checked
    });
  } catch (err) {
    mostrarMensagem((err as Error).message, 'erro');
    return;
  }
  const total = Math.round(clipe.duracao * clipe.fps) + 1;
  let i = 0;
  tocando = window.setInterval(() => {
    const rotacoes: RotacoesQuadro = {};
    for (const [osso, valores] of Object.entries(clipe.ossos) as Array<[OssoGravado, number[]]>) {
      rotacoes[osso] = valores.slice(i * 4, i * 4 + 4) as Quat;
    }
    previa.aplicarRotacoes(rotacoes);
    i = (i + 1) % total;
  }, 1000 / clipe.fps);
  btnTocar.textContent = 'Parar';
}

function baixar(): void {
  try {
    const clipe = montar();
    const blob = new Blob([serializarClipe(clipe)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${clipe.nome}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    mostrarMensagem(`Baixado ${clipe.nome}.json. Coloque em public/avatar/animacoes/ e adicione ao manifesto.json.`, 'ok');
  } catch (err) {
    mostrarMensagem((err as Error).message, 'erro');
  }
}

async function salvarNoProjeto(): Promise<void> {
  try {
    const clipe = montar();
    const corpo = JSON.stringify({ nome: clipe.nome, clipe: JSON.parse(serializarClipe(clipe)) });
    const resposta = await fetch('/__gravador/salvar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Erro ao salvar.');
    mostrarMensagem(`Salvo em ${dados.salvo} e adicionado ao manifesto.`, 'ok');
  } catch (err) {
    mostrarMensagem((err as Error).message, 'erro');
  }
}

/* ==========================================================================
   AUTOTESTE (CT18): ida e volta avatar → MediaPipe → conversor → avatar
   ========================================================================== */
async function rodarAutoteste(): Promise<void> {
  const saida = $('resultado-autoteste');
  saida.textContent = 'Rodando…';
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const poseImagem = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODELO_POSE, delegate: 'GPU' },
    runningMode: 'IMAGE',
    numPoses: 1
  });

  const tela = document.createElement('canvas');
  tela.width = 512;
  tela.height = 512;
  const renderer = new THREE.WebGLRenderer({ canvas: tela, preserveDrawingBuffer: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 1.05, 2.9);
  camera.lookAt(0, 1.0, 0);
  const fundoOriginal = previa.scene.background;
  previa.scene.background = new THREE.Color(0x8899aa);

  const poses: Record<string, PoseVRM> = {
    repouso: POSE_IDLE,
    'maos-juntas': POSES_REPOUSO[1],
    'palmas-abertas': POSES_GESTOS_FALA['palmas-abertas'],
    enfatizar: POSES_GESTOS_FALA['enfatizar'],
    'contar-dedos': POSES_GESTOS_FALA['contar-dedos'],
    pensando: POSE_THINKING,
    cumprimentar: POSE_CUMPRIMENTAR
  };
  const segmentos: Array<[VRMHumanBoneName, VRMHumanBoneName]> = [
    ['leftUpperArm', 'leftLowerArm'],
    ['leftLowerArm', 'leftHand'],
    ['rightUpperArm', 'rightLowerArm'],
    ['rightLowerArm', 'rightHand']
  ];

  const linhas: string[] = [];
  for (const [nome, poseTeste] of Object.entries(poses)) {
    previa.aplicarPose({ ...POSE_IDLE, ...poseTeste });
    const esperadas = segmentos.map(([a, b]) => previa.direcaoOsso(a, b));
    renderer.render(previa.scene, camera);
    const det = poseImagem.detect(tela);
    if (!det.landmarks.length) {
      linhas.push(`<tr><td>${nome}</td><td colspan="5">não detectado</td></tr>`);
      continue;
    }
    const { rotacoes } = converterQuadro(det.worldLandmarks[0], det.landmarks[0]);
    previa.aplicarRotacoes(rotacoes);
    const erros = segmentos.map(([a, b], i) => Math.round(THREE.MathUtils.radToDeg(previa.direcaoOsso(a, b).angleTo(esperadas[i]))));
    const media = Math.round(erros.reduce((s, e) => s + e, 0) / erros.length);
    linhas.push(`<tr><td>${nome}</td>${erros.map(e => `<td>${e}°</td>`).join('')}<td><b>${media}°</b> ${media <= 25 ? '✅' : '⚠️'}</td></tr>`);
  }

  previa.scene.background = fundoOriginal;
  previa.aplicarPose(POSE_IDLE);
  renderer.dispose();
  poseImagem.close();
  saida.innerHTML = `<table><tr><th>pose</th><th>braço E</th><th>antebraço E</th><th>braço D</th><th>antebraço D</th><th>média</th></tr>${linhas.join('')}</table>`;
}

/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */
function iniciar(): void {
  for (const persona of PERSONAS) {
    selPersonaPrevia.add(new Option(persona.nome, persona.id));
    const rotulo = document.createElement('label');
    rotulo.innerHTML = `<input type="checkbox" value="${persona.id}" /> ${persona.nome}`;
    $('lista-personas').appendChild(rotulo);
  }
  selPersonaPrevia.value = obterPersonaPadrao().id;
  const carregarPersona = () => {
    const persona = PERSONAS.find(p => p.id === selPersonaPrevia.value) || obterPersonaPadrao();
    previa.carregar(obterModeloPersona(persona)).catch(err => mostrarMensagem(`Erro ao carregar o avatar: ${err.message}`, 'erro'));
  };
  selPersonaPrevia.addEventListener('change', carregarPersona);
  carregarPersona();

  btnWebcam.addEventListener('click', () => void usarWebcam());
  btnGravar.addEventListener('click', () => void gravar());
  btnParar.addEventListener('click', parar);
  arquivoVideo.addEventListener('change', selecionarArquivo);
  btnProcessar.addEventListener('click', () => void processarArquivo().catch(err => mostrarMensagem(err.message, 'erro')));
  btnCalibrar.addEventListener('click', () => {
    if (!ultimaCabecaBruta) {
      mostrarMensagem('Nenhum rosto detectado ainda para calibrar.', 'erro');
      return;
    }
    cabecaNeutra = ultimaCabecaBruta;
    mostrarMensagem('Cabeça calibrada.', 'ok');
  });
  rngSuavidade.addEventListener('change', () => (suavizador = new SuavizadorRotacoes(Number(rngSuavidade.value))));
  rngInicio.addEventListener('input', atualizarRecorte);
  rngFim.addEventListener('input', atualizarRecorte);
  btnTocar.addEventListener('click', alternarTocar);
  btnBaixar.addEventListener('click', baixar);
  btnSalvar.addEventListener('click', () => void salvarNoProjeto());
  $('btn-autoteste').addEventListener('click', () => void rodarAutoteste().catch(err => mostrarMensagem(err.message, 'erro')));

  // RF11: a câmera desliga ao sair da página
  window.addEventListener('pagehide', pararCamera);
}

iniciar();
