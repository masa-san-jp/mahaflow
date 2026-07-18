/**
 * Smooth field-view fragment shader. Implements the same evalField formula
 * as src/math/project.ts (design spec §4.5) so the two can be cross-checked
 * pointwise (T-M11, later phase).
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

  vec3 palette(float x) {
    return 0.5 + 0.5 * cos(6.28318530718 * (uPaletteFreq * x + uPalettePhase));
  }

  void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * 2.0 * aspect / uZoom + uPan;
    float d = evalD(p);
    vec3 color = palette(clamp(exp(-0.32 * d) * 0.9 + 0.06, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
  }
`;
