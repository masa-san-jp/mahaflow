import { MahaFlowCore, type CoreDeps } from '../core/MahaFlowCore';
import type { InitConfig } from '../core/types';
import type { LiveParams, Mode, Terrain } from '../core/config';
import type { MahaEvent } from '../core/events';

const MODE_NAMES: Record<string, Mode> = { smooth: 0, wave: 1, capillary: 2, particle: 3 };
const TERRAIN_NAMES: Record<string, Terrain> = { mountains: 0, bowl: 1 };

/** Attribute name -> LiveParams patch parser (design spec §5.3). Returns null for an unrecognized value. */
const LIVE_ATTR_PARSERS: Record<string, (v: string) => Partial<LiveParams> | null> = {
  view: (v) => (v === 'field' || v === 'orbit' ? { view: v } : null),
  mode: (v) => (v in MODE_NAMES ? { mode: MODE_NAMES[v] } : null),
  terrain: (v) => (v in TERRAIN_NAMES ? { terrain: TERRAIN_NAMES[v] } : null),
  palette: (v) => ({ palette: v }),
  zoom: (v) => ({ zoom: Number(v) }),
  softness: (v) => ({ softness: Number(v) }),
  spread: (v) => ({ spread: Number(v) }),
  anisotropy: (v) => ({ anisotropy: Number(v) }),
  speed: (v) => ({ speed: Number(v) }),
  clustercount: (v) => ({ clusterCount: Number(v) }),
};

const RELAYED_EVENTS: MahaEvent[] = ['ready', 'statechange', 'hover', 'warning', 'exportprogress', 'exportdone', 'exporterror'];

/**
 * `<maha-flow>` Web Component shell (design spec §5.3): attributes bind to
 * InitConfig/LiveParams, core events relay as `maha-`-prefixed CustomEvents,
 * and `.core` exposes the underlying MahaFlowCore for programmatic control.
 */
export class MahaFlowElement extends HTMLElement {
  core: MahaFlowCore | null = null;
  /** Test-only hook: set before appending to the DOM to inject a fake renderer (see test/contract). */
  coreDeps?: CoreDeps;
  private unsubscribers: Array<() => void> = [];

  static get observedAttributes(): string[] {
    return ['view', 'mode', 'terrain', 'palette', 'zoom', 'softness', 'spread', 'anisotropy', 'speed', 'clustercount'];
  }

  connectedCallback(): void {
    if (this.core) return;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    // seed is required (design spec §5.1 T-A01); a missing/invalid seed
    // throws synchronously here, same contract as the core constructor.
    this.core = new MahaFlowCore(this, this.readInitConfig(), this.coreDeps ?? {});
    for (const event of RELAYED_EVENTS) {
      this.unsubscribers.push(
        this.core.on(event, (payload) => {
          this.dispatchEvent(new CustomEvent(`maha-${event}`, { detail: payload, bubbles: true }));
        }),
      );
    }
  }

  disconnectedCallback(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.core?.dispose();
    this.core = null;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (!this.core || newValue === null) return;
    const parse = LIVE_ATTR_PARSERS[name];
    const patch = parse?.(newValue);
    if (patch) this.core.setConfig(patch);
  }

  private readInitConfig(): InitConfig {
    const seedAttr = this.getAttribute('seed');
    const config: InitConfig = { seed: seedAttr === null ? NaN : Number(seedAttr) };

    const dims = this.getAttribute('dims');
    if (dims !== null) config.dims = Number(dims);
    const maxClusters = this.getAttribute('maxclusters');
    if (maxClusters !== null) config.maxClusters = Number(maxClusters);
    const pixelRatio = this.getAttribute('pixelratio');
    if (pixelRatio !== null) config.pixelRatio = Number(pixelRatio);
    const ui = this.getAttribute('ui');
    if (ui === 'dev' || ui === 'none') config.ui = ui;
    const preset = this.getAttribute('preset');
    if (preset !== null) config.preset = preset;

    const autoplay = this.getAttribute('autoplay');
    if (autoplay !== null) {
      try {
        config.autoplay = JSON.parse(autoplay);
      } catch {
        // Malformed JSON: ignored, autoplay simply doesn't start from the attribute.
      }
    }

    const initialLive: Partial<LiveParams> = {};
    for (const [attr, parse] of Object.entries(LIVE_ATTR_PARSERS)) {
      const value = this.getAttribute(attr);
      if (value === null) continue;
      const patch = parse(value);
      if (patch) Object.assign(initialLive, patch);
    }
    if (Object.keys(initialLive).length > 0) config.initialLive = initialLive;

    return config;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('maha-flow')) {
  customElements.define('maha-flow', MahaFlowElement);
}
