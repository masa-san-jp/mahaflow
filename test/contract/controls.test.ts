import { describe, expect, it } from 'vitest';
import { attachControls } from '../../src/interact/controls';
import { DEFAULT_LIVE_PARAMS } from '../../src/core/config';

function makeHost(initial: { zoom: number; pan: [number, number]; view?: 'field' | 'orbit' }) {
  const state = { ...initial, orbit: { ...DEFAULT_LIVE_PARAMS.orbit } };
  const calls: Array<{ zoom: number; pan: [number, number] }> = [];
  const orbitCalls: Array<typeof state.orbit> = [];
  return {
    host: {
      getView: () => state.view ?? 'field',
      getZoomPan: () => ({ zoom: state.zoom, pan: state.pan }),
      setZoomPan(zoom: number, pan: [number, number]) {
        state.zoom = zoom;
        state.pan = pan;
        calls.push({ zoom, pan });
      },
      getOrbit: () => state.orbit,
      setOrbit(orbit: typeof state.orbit) {
        state.orbit = orbit;
        orbitCalls.push(orbit);
      },
    },
    calls,
    orbitCalls,
  };
}

describe('T-I02/T-I03 wheel zoom is element-scoped', () => {
  it('wheel over the container changes zoom via the host callback', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { host, calls } = makeHost({ zoom: 1, pan: [0, 0] });
    const detach = attachControls(container, host);

    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.zoom).toBeGreaterThan(1); // scroll up (negative deltaY) zooms in

    detach();
    container.remove();
  });

  it('does nothing to an unrelated instance (element scoping, T-I02)', () => {
    const containerA = document.createElement('div');
    const containerB = document.createElement('div');
    document.body.append(containerA, containerB);
    const { host: hostA, calls: callsA } = makeHost({ zoom: 1, pan: [0, 0] });
    const { calls: callsB } = makeHost({ zoom: 1, pan: [0, 0] });
    attachControls(containerA, hostA);

    containerB.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));

    expect(callsA).toHaveLength(0);
    expect(callsB).toHaveLength(0);

    containerA.remove();
    containerB.remove();
  });
});

describe('T-I04 drag pans without affecting zoom (field view)', () => {
  it('pointerdown -> pointermove -> pointerup updates pan only', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }),
    });
    // jsdom elements don't implement pointer capture.
    (container as any).setPointerCapture = () => {};

    const { host, calls } = makeHost({ zoom: 2, pan: [0, 0] });
    const detach = attachControls(container, host);

    // jsdom has no PointerEvent constructor; MouseEvent carries the clientX/clientY the handlers read.
    container.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    container.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 90, bubbles: true }));
    container.dispatchEvent(new MouseEvent('pointerup', { clientX: 120, clientY: 90, bubbles: true }));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.zoom).toBe(2); // unchanged by drag
    expect(calls[0]!.pan[0]).not.toBe(0);
    expect(calls[0]!.pan[1]).not.toBe(0);

    // Further move after pointerup should not pan again.
    container.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 200, bubbles: true }));
    expect(calls).toHaveLength(1);

    detach();
    container.remove();
  });
});

describe('T-I04 orbit view: drag rotates, Shift+drag pans, wheel dollies', () => {
  it('plain drag changes theta/phi, not tx/tz', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    (container as any).setPointerCapture = () => {};
    const { host, orbitCalls } = makeHost({ zoom: 1, pan: [0, 0], view: 'orbit' });
    const detach = attachControls(container, host);

    container.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    container.dispatchEvent(new MouseEvent('pointermove', { clientX: 130, clientY: 80, bubbles: true }));

    expect(orbitCalls).toHaveLength(1);
    expect(orbitCalls[0]!.theta).not.toBe(DEFAULT_LIVE_PARAMS.orbit.theta);
    expect(orbitCalls[0]!.tx).toBe(DEFAULT_LIVE_PARAMS.orbit.tx);
    expect(orbitCalls[0]!.tz).toBe(DEFAULT_LIVE_PARAMS.orbit.tz);

    detach();
    container.remove();
  });

  it('Shift+drag pans tx/tz without rotating', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    (container as any).setPointerCapture = () => {};
    const { host, orbitCalls } = makeHost({ zoom: 1, pan: [0, 0], view: 'orbit' });
    const detach = attachControls(container, host);

    container.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true, shiftKey: true }));
    container.dispatchEvent(new MouseEvent('pointermove', { clientX: 130, clientY: 80, bubbles: true, shiftKey: true }));

    expect(orbitCalls).toHaveLength(1);
    expect(orbitCalls[0]!.theta).toBe(DEFAULT_LIVE_PARAMS.orbit.theta);
    expect(orbitCalls[0]!.tx !== DEFAULT_LIVE_PARAMS.orbit.tx || orbitCalls[0]!.tz !== DEFAULT_LIVE_PARAMS.orbit.tz).toBe(true);

    detach();
    container.remove();
  });

  it('wheel changes orbit.r, not zoom', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { host, calls, orbitCalls } = makeHost({ zoom: 1, pan: [0, 0], view: 'orbit' });
    const detach = attachControls(container, host);

    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));

    expect(calls).toHaveLength(0);
    expect(orbitCalls).toHaveLength(1);
    expect(orbitCalls[0]!.r).not.toBe(DEFAULT_LIVE_PARAMS.orbit.r);

    detach();
    container.remove();
  });
});
