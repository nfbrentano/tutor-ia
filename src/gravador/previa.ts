/**
 * TUTORIA - Pré-visualização do gravador: avatar VRM que recebe as rotações gravadas (RF06)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMHumanBoneName, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

import { POSE_IDLE } from '../avatar3d/poses';
import { PoseVRM } from '../avatar3d/tipos';
import { OssoGravado, Quat, RotacoesQuadro } from './tipos';

export class PreviaAvatar {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 20);
  vrm: VRM | null = null;
  private relogio = new THREE.Timer();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const luz = new THREE.DirectionalLight(0xffffff, 1.2);
    luz.position.set(0.6, 1.6, 2);
    this.scene.add(luz);
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());

    const loop = (t: number) => {
      requestAnimationFrame(loop);
      this.relogio.update(t);
      this.vrm?.update(Math.min(this.relogio.getDelta(), 0.1));
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  private redimensionar(): void {
    const w = this.canvas.clientWidth || 480;
    const h = this.canvas.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async carregar(url: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM;
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse(o => (o.frustumCulled = false));

    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.vrm = vrm;
    this.scene.add(vrm.scene);
    this.aplicarPose(POSE_IDLE);

    // Enquadramento da cintura para cima, como no tutor
    const cabeca = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldPosition(new THREE.Vector3());
    this.camera.position.set(0, cabeca.y - 0.2, 2.1);
    this.camera.lookAt(0, cabeca.y - 0.35, 0);
  }

  aplicarPose(pose: PoseVRM): void {
    if (!this.vrm) return;
    this.vrm.humanoid.resetNormalizedPose();
    for (const [osso, r] of Object.entries(pose)) {
      this.vrm.humanoid.getNormalizedBoneNode(osso as VRMHumanBoneName)?.rotation.set(r.x, r.y, r.z);
    }
    this.vrm.update(0);
  }

  /** Aplica as rotações gravadas; ossos ausentes ficam na pose de repouso. */
  aplicarRotacoes(rotacoes: RotacoesQuadro): void {
    if (!this.vrm) return;
    this.aplicarPose(POSE_IDLE);
    for (const [osso, q] of Object.entries(rotacoes) as Array<[OssoGravado, Quat]>) {
      this.vrm.humanoid.getNormalizedBoneNode(osso as VRMHumanBoneName)?.quaternion.set(q[0], q[1], q[2], q[3]);
    }
    this.vrm.update(0);
  }

  direcaoOsso(de: VRMHumanBoneName, para: VRMHumanBoneName): THREE.Vector3 {
    const a = this.vrm!.humanoid.getNormalizedBoneNode(de)!.getWorldPosition(new THREE.Vector3());
    const b = this.vrm!.humanoid.getNormalizedBoneNode(para)!.getWorldPosition(new THREE.Vector3());
    return b.sub(a).normalize();
  }
}
