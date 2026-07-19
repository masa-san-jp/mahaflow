import type { OrbitState } from '../core/config';

/**
 * Element-scoped zoom/pan/orbit input (design spec §3.2 rule 2 / P2-2): all
 * listeners attach to the container element only, never window/document.
 * Field view: wheel zooms, drag pans. Orbit view: wheel dollies the camera
 * distance, plain drag rotates (theta/phi), Shift+drag pans the look-at
 * target (design spec T-I04).
 */
export interface ControlsHost {
  getView(): 'field' | 'orbit';
  getZoomPan(): { zoom: number; pan: [number, number] };
  setZoomPan(zoom: number, pan: [number, number]): void;
  getOrbit(): OrbitState;
  setOrbit(orbit: OrbitState): void;
}

const ZOOM_WHEEL_SENSITIVITY = 0.001;
const ORBIT_ROTATE_SENSITIVITY = 0.005;
const ORBIT_PAN_SENSITIVITY = 0.01;
const ORBIT_R_MIN = 1;
const ORBIT_R_MAX = 40;
const ORBIT_PHI_MIN = 0.05;
const ORBIT_PHI_MAX = Math.PI - 0.05;

export function attachControls(container: HTMLElement, host: ControlsHost): () => void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (host.getView() === 'orbit') {
      const orbit = host.getOrbit();
      const factor = Math.exp(e.deltaY * ZOOM_WHEEL_SENSITIVITY);
      host.setOrbit({ ...orbit, r: Math.min(ORBIT_R_MAX, Math.max(ORBIT_R_MIN, orbit.r * factor)) });
      return;
    }
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
    const dxPx = e.clientX - lastX;
    const dyPx = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (host.getView() === 'orbit') {
      const orbit = host.getOrbit();
      if (e.shiftKey) {
        // Pan the look-at target in the camera's local right/up plane.
        const theta = orbit.theta;
        const rightX = Math.cos(theta);
        const rightZ = -Math.sin(theta);
        const scale = ORBIT_PAN_SENSITIVITY * (orbit.r / 10);
        host.setOrbit({
          ...orbit,
          tx: orbit.tx - dxPx * scale * rightX,
          tz: orbit.tz - dxPx * scale * rightZ,
          ty: orbit.ty + dyPx * scale,
        });
      } else {
        host.setOrbit({
          ...orbit,
          theta: orbit.theta - dxPx * ORBIT_ROTATE_SENSITIVITY,
          phi: Math.min(ORBIT_PHI_MAX, Math.max(ORBIT_PHI_MIN, orbit.phi - dyPx * ORBIT_ROTATE_SENSITIVITY)),
        });
      }
      return;
    }

    const { zoom, pan } = host.getZoomPan();
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
