/**
 * Field-view fragment shader. Implements the same evalField/evalWave
 * formulas as src/math/project.ts (design spec §4.5) so the two can be
 * cross-checked pointwise (T-M11, later phase).
 *
 * Mode support (design spec §6.1): 0=smooth, 1=wave, 2=capillary use this
 * shader's color modulation; 3=particle is a separate point-sprite system
 * (P2b, not yet implemented) — this shader still renders the smooth field
 * as a fallback so setConfig({mode:3}) never leaves the canvas blank.
 */
export const MAX_CLUSTERS = 8;

export const fieldVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const fieldFragmentShader = /* glsl */ `
  precision highp float;

  #define MAX_CLUSTERS ${MAX_CLUSTERS}
  #define MODE_SMOOTH 0
  #define MODE_WAVE 1
  #define MODE_CAPILLARY 2

  uniform int uClusterCount;
  uniform vec2 uM[MAX_CLUSTERS];
  uniform vec3 uABC[MAX_CLUSTERS];
  uniform float uAmp[MAX_CLUSTERS];
  uniform float uTau;
  uniform vec2 uResolution;
  uniform float uZoom;
  uniform vec2 uPan;
  uniform vec3 uPaletteFreq;
  uniform vec3 uPalettePhase;
  uniform int uMode;
  uniform float uTime;

  varying vec2 vUv;

  float squaredDistance(vec2 p, vec2 m, vec3 abc) {
    vec2 d = p - m;
    return abc.x * d.x * d.x + 2.0 * abc.y * d.x * d.y + abc.z * d.y * d.y;
  }

  float evalD(vec2 p) {
    float s = 0.0;
    for (int i = 0; i < MAX_CLUSTERS; i++) {
      if (i >= uClusterCount) break;
      float d2 = squaredDistance(p, uM[i], uABC[i]);
      s += uAmp[i] * exp(-d2 / uTau);
    }
    float sClamped = max(s, 1e-6);
    return sqrt(max(-uTau * log(sClamped) + uTau * log(2.2), 0.0));
  }

  // wave(p) = sum amp_i * sin(6.5*d_i - 1.9t) * exp(-0.42*d_i), d_i = sqrt(d2_i)
  float evalWave(vec2 p) {
    float wave = 0.0;
    for (int i = 0; i < MAX_CLUSTERS; i++) {
      if (i >= uClusterCount) break;
      float d = sqrt(squaredDistance(p, uM[i], uABC[i]));
      wave += uAmp[i] * sin(6.5 * d - 1.9 * uTime) * exp(-0.42 * d);
    }
    return wave;
  }

  vec3 palette(float x) {
    return 0.5 + 0.5 * cos(6.28318530718 * (uPaletteFreq * x + uPalettePhase));
  }

  void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * 2.0 * aspect / uZoom + uPan;
    float d = evalD(p);
    float intensity = clamp(exp(-0.32 * d) * 0.9 + 0.06, 0.0, 1.0);

    if (uMode == MODE_WAVE) {
      intensity = clamp(intensity + 0.5 * evalWave(p), 0.0, 1.0);
    } else if (uMode == MODE_CAPILLARY) {
      float ridge = 1.0 - abs(fract(d * 3.0) - 0.5) * 2.0;
      intensity = clamp(intensity + 0.25 * ridge * ridge * ridge * exp(-0.35 * d), 0.0, 1.0);
    }

    vec3 color = palette(intensity);
    gl_FragColor = vec4(color, 1.0);
  }
`;
