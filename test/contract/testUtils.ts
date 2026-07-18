import type { FieldRenderer, FrameUniforms } from '../../src/render/fieldView';

export class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  trigger(width: number, height: number) {
    this.callback(
      [{ contentRect: { width, height } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

export interface FakeRenderer extends FieldRenderer {
  setSizeCalls: Array<[number, number, number]>;
  renderCalls: FrameUniforms[];
  disposeCalls: number;
}

export function makeFakeRenderer(): FakeRenderer {
  const setSizeCalls: Array<[number, number, number]> = [];
  const renderCalls: FrameUniforms[] = [];
  let disposeCalls = 0;
  return {
    canvas: document.createElement('canvas'),
    ready: Promise.resolve(),
    setSize(w: number, h: number, pr: number) {
      setSizeCalls.push([w, h, pr]);
    },
    renderFrame(frame: FrameUniforms) {
      renderCalls.push(frame);
    },
    dispose() {
      disposeCalls++;
    },
    get setSizeCalls() {
      return setSizeCalls;
    },
    get renderCalls() {
      return renderCalls;
    },
    get disposeCalls() {
      return disposeCalls;
    },
  } as unknown as FakeRenderer;
}

export function installBrowserStubs(): void {
  FakeResizeObserver.instances = [];
  (globalThis as any).ResizeObserver = FakeResizeObserver;
  if (!(globalThis as any).requestAnimationFrame) {
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number;
    (globalThis as any).cancelAnimationFrame = (h: number) => clearTimeout(h);
  }
}
