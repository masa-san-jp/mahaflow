/**
 * Screen-pixel -> field-space mapping, mirroring the fragment shader's
 * `p = (vUv - 0.5) * 2 * aspect / zoom + pan` (render/shaders/field.glsl.ts)
 * so hover queries (design spec §5.2) report the same D the shader draws.
 */
export function screenToField(
  xPx: number,
  yPx: number,
  widthPx: number,
  heightPx: number,
  zoom: number,
  pan: [number, number],
): [number, number] {
  const aspectX = widthPx / heightPx;
  const uvX = xPx / widthPx;
  const uvY = 1 - yPx / heightPx; // canvas Y grows downward; shader UV grows upward
  const px = (uvX - 0.5) * 2 * aspectX * (1 / zoom) + pan[0];
  const py = (uvY - 0.5) * 2 * (1 / zoom) + pan[1];
  return [px, py];
}
