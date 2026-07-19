import * as THREE from 'three';
import { evalField, type ProjCluster } from '../math/project';
import { terrainHeight, floorIsoline } from '../math/terrain';
import { generatePointCloud, pointDisplayPosition, pointPaletteIntensity, pointVisualSize } from '../math/pointcloud';
import { paletteColor } from '../palette/luminance';
import type { PaletteDef } from '../palette/palettes';
import type { GeneratedCluster } from '../math/cluster';
import type { Mode, OrbitState, Terrain } from '../core/config';

const TERRAIN_SPAN = 8;
const TERRAIN_SEGMENTS = 64;
const FLOOR_Y = -0.55;
const POINT_COUNT = 1500;

export interface OrbitFrameData {
  projected: ProjCluster[];
  amps: number[];
  tau: number;
  mode: Mode;
  terrain: Terrain;
  flow: number;
  time: number;
  palette: PaletteDef;
  orbit: OrbitState;
  /** Full n-dimensional clusters and their current tour basis, for point-cloud sampling (design spec §4.6). */
  clusters: GeneratedCluster[];
  clusterCount: number;
  basis: { u: number[]; v: number[]; w: number[] };
  seed: number;
  /** Auto-quality degradation (design spec §13): sample fewer points under sustained frame-time pressure. Defaults to the full 1500. */
  pointCount?: number;
}

export interface OrbitRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ready: Promise<void>;
  setSize(width: number, height: number, pixelRatio: number): void;
  renderFrame(data: OrbitFrameData): void;
  dispose(): void;
}

/**
 * Orbit view (P2b): a 3D terrain height-field over the density/distance
 * field (design spec §4.8), a projection floor with isolines, and an
 * n-dimensional point cloud (§4.6), viewed with an orbiting camera.
 *
 * Deviations from the literal spec text, both functionally equivalent:
 * - Terrain normals come from `computeVertexNormals()` on the displaced
 *   mesh (real per-vertex normals) rather than fragment-shader dFdx/dFdy.
 * - Height/color are computed on the CPU per vertex each frame (reusing
 *   the already-tested math/*.ts reference implementations) rather than
 *   in a vertex shader, trading some performance for reuse/testability.
 */
export function createOrbitRenderer(canvas: HTMLCanvasElement): OrbitRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(3, 6, 4);
  scene.add(keyLight);

  const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SPAN, TERRAIN_SPAN, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  terrainGeometry.rotateX(-Math.PI / 2);
  const terrainColors = new Float32Array(terrainGeometry.attributes.position!.count * 3);
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));
  const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
  scene.add(terrainMesh);

  const floorGeometry = new THREE.PlaneGeometry(TERRAIN_SPAN, TERRAIN_SPAN, 1, 1);
  floorGeometry.rotateX(-Math.PI / 2);
  floorGeometry.translate(0, FLOOR_Y, 0);
  const floorUniforms = {
    uSpan: { value: TERRAIN_SPAN },
    uProjected: { value: [] as { m: [number, number]; a: number; b: number; c: number }[] },
  };
  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x0a1420, transparent: true, opacity: 0.85 });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  const floorColors = new Float32Array((floorGeometry.attributes.position as THREE.BufferAttribute).count * 3);
  floorGeometry.setAttribute('color', new THREE.BufferAttribute(floorColors, 3));
  floorMaterial.vertexColors = true;
  scene.add(floorMesh);
  void floorUniforms; // reserved for a future GLSL-chunk-based floor (see README known-gaps)

  const pointsGeometry = new THREE.BufferGeometry();
  const pointPositions = new Float32Array(POINT_COUNT * 3);
  const pointColors = new Float32Array(POINT_COUNT * 3);
  const pointSizes = new Float32Array(POINT_COUNT);
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
  pointsGeometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  pointsGeometry.setAttribute('size', new THREE.BufferAttribute(pointSizes, 1));
  const pointsMaterial = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    uniforms: { uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size;
      varying vec3 vColor;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (100.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
  });
  const points = new THREE.Points(pointsGeometry, pointsMaterial);
  scene.add(points);

  const ready = Promise.resolve().then(() => {
    renderer.compile(scene, camera);
  });

  let lastPointCloudKey = '';

  return {
    canvas,
    ready,
    setSize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      pointsMaterial.uniforms.uPixelRatio!.value = pixelRatio;
    },
    renderFrame(data) {
      const showTerrain = data.mode !== 3;
      terrainMesh.visible = showTerrain;
      floorMesh.visible = showTerrain;

      if (showTerrain) {
        const posAttr = terrainGeometry.attributes.position as THREE.BufferAttribute;
        const colorAttr = terrainGeometry.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i);
          const z = posAttr.getZ(i);
          const p: [number, number] = [x, z];
          const h = terrainHeight(p, data.projected, data.amps, data.tau, data.time, data.terrain, data.mode, data.flow);
          posAttr.setY(i, h);
          const { D } = evalField(p, data.projected, data.amps, data.tau);
          const intensity = Math.min(1, Math.max(0, Math.exp(-0.32 * D) * 0.9 + 0.06));
          const [r, g, b] = paletteColor(data.palette, intensity);
          colorAttr.setXYZ(i, r, g, b);
        }
        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        terrainGeometry.computeVertexNormals();

        const floorPos = floorGeometry.attributes.position as THREE.BufferAttribute;
        const floorColorAttr = floorGeometry.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < floorPos.count; i++) {
          const p: [number, number] = [floorPos.getX(i), floorPos.getZ(i)];
          const iso = floorIsoline(p, data.projected, data.amps, data.tau);
          const shade = 0.05 + 0.15 * (iso > 0.9 || iso < 0.1 ? 1 : 0);
          floorColorAttr.setXYZ(i, shade, shade * 1.3, shade * 1.6);
        }
        floorColorAttr.needsUpdate = true;
      }

      const cloudKey = `${data.seed}:${data.clusterCount}`;
      if (cloudKey !== lastPointCloudKey) {
        lastPointCloudKey = cloudKey;
      }
      const visibleClusters = data.clusters.slice(0, data.clusterCount);
      const pointCount = Math.min(data.pointCount ?? POINT_COUNT, POINT_COUNT);
      const samples = generatePointCloud(data.seed, visibleClusters, pointCount);
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]!;
        const [px, py, pz] = pointDisplayPosition(sample.x, data.basis.u, data.basis.v, data.basis.w);
        pointPositions[i * 3] = px;
        pointPositions[i * 3 + 1] = py;
        pointPositions[i * 3 + 2] = pz;
        const intensity = pointPaletteIntensity(sample.trueDistance);
        const [r, g, b] = paletteColor(data.palette, intensity);
        pointColors[i * 3] = r;
        pointColors[i * 3 + 1] = g;
        pointColors[i * 3 + 2] = b;
        pointSizes[i] = pointVisualSize(sample.trueDistance);
      }
      (pointsGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (pointsGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (pointsGeometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
      pointsGeometry.setDrawRange(0, samples.length);

      const { orbit } = data;
      camera.position.set(
        orbit.tx + orbit.r * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        orbit.ty + orbit.r * Math.cos(orbit.phi),
        orbit.tz + orbit.r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      );
      camera.lookAt(orbit.tx, orbit.ty, orbit.tz);

      renderer.render(scene, camera);
    },
    dispose() {
      terrainGeometry.dispose();
      terrainMaterial.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      renderer.dispose();
      const loseContext = renderer.getContext().getExtension('WEBGL_lose_context');
      loseContext?.loseContext();
    },
  };
}
