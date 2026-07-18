import * as THREE from 'three';
import type { ProjCluster } from '../math/project';
import { MAX_CLUSTERS, fieldFragmentShader, fieldVertexShader } from './shaders/field.glsl';

export interface PaletteDef {
  freq: [number, number, number];
  phase: [number, number, number];
}

export const AURORA_PALETTE: PaletteDef = {
  freq: [1.0, 1.0, 1.0],
  phase: [0.0, 0.33, 0.67],
};

export interface FrameUniforms {
  projected: ProjCluster[];
  amps: number[];
  tau: number;
  zoom?: number;
  pan?: [number, number];
  palette?: PaletteDef;
}

export interface FieldRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ready: Promise<void>;
  setSize(width: number, height: number, pixelRatio: number): void;
  renderFrame(uniforms: FrameUniforms): void;
  dispose(): void;
}

/**
 * Smooth field-view renderer (P0-6). A single full-screen shader plane
 * evaluating evalField(); mode/view/terrain branching beyond "smooth" +
 * "field" is P2 scope.
 */
export function createFieldRenderer(canvas: HTMLCanvasElement): FieldRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uClusterCount: { value: 0 },
    uM: { value: Array.from({ length: MAX_CLUSTERS }, () => new THREE.Vector2()) },
    uABC: { value: Array.from({ length: MAX_CLUSTERS }, () => new THREE.Vector3()) },
    uAmp: { value: new Array(MAX_CLUSTERS).fill(0) },
    uTau: { value: 0.85 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uZoom: { value: 1 },
    uPan: { value: new THREE.Vector2(0, 0) },
    uPaletteFreq: { value: new THREE.Vector3(...AURORA_PALETTE.freq) },
    uPalettePhase: { value: new THREE.Vector3(...AURORA_PALETTE.phase) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fieldVertexShader,
    fragmentShader: fieldFragmentShader,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const ready = Promise.resolve().then(() => {
    // Force a compile so `ready` reflects real shader-compile completion.
    renderer.compile(scene, camera);
  });

  return {
    canvas,
    ready,
    setSize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
    },
    renderFrame(frame) {
      const count = Math.min(frame.projected.length, MAX_CLUSTERS);
      uniforms.uClusterCount.value = count;
      for (let i = 0; i < count; i++) {
        const proj = frame.projected[i] as ProjCluster;
        (uniforms.uM.value[i] as THREE.Vector2).set(proj.m[0], proj.m[1]);
        (uniforms.uABC.value[i] as THREE.Vector3).set(proj.a, proj.b, proj.c);
        uniforms.uAmp.value[i] = frame.amps[i] as number;
      }
      uniforms.uTau.value = frame.tau;
      uniforms.uZoom.value = frame.zoom ?? 1;
      const pan = frame.pan ?? [0, 0];
      uniforms.uPan.value.set(pan[0], pan[1]);
      if (frame.palette) {
        uniforms.uPaletteFreq.value.set(...frame.palette.freq);
        uniforms.uPalettePhase.value.set(...frame.palette.phase);
      }
      renderer.render(scene, camera);
    },
    dispose() {
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
      const loseContext = renderer.getContext().getExtension('WEBGL_lose_context');
      loseContext?.loseContext();
    },
  };
}
