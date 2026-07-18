/**
 * Element-scoped zoom/pan input (design spec §3.2 rule 2 / P2-2): all
 * listeners attach to the container element only, never window/document.
 */
export interface ControlsHost {
  getZoomPan(): { zoom: number; pan: [number, number] };
  setZoomPan(zoom: number, pan: [number, number]): void;
}

const ZOOM_WHEEL_SENSITIVITY = 0.001;

export function attachControls(container: HTMLElement, host: ControlsHost): () => void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const { zoom, pan } = host.getZoomPan();
    const factor = Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY);
    host.setZoomPan(zoom * factor, pan);
  };

  const onPointerDown = (e: PointerEvent): void => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    container.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const { zoom, pan } = host.getZoomPan();
    const dxPx = e.clientX - lastX;
    const dyPx = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const rect = container.getBoundingClientRect();
    // Field units per pixel, matching the shader's (vUv-0.5)*2/zoom mapping.
    const scale = 2 / Math.max(rect.height, 1) / zoom;
    host.setZoomPan(zoom, [pan[0] - dxPx * scale, pan[1] + dyPx * scale]);
  };

  const onPointerUp = (): void => {
    dragging = false;
  };

  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointerleave', onPointerUp);

  return () => {
    container.removeEventListener('wheel', onWheel);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointerleave', onPointerUp);
  };
}
