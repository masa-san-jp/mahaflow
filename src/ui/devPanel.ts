import type { LiveParams, Mode } from '../core/config';
import type { State } from '../core/state';
import type { MahaEvent, MahaEventMap } from '../core/events';

/**
 * Minimal surface the dev panel needs from MahaFlowCore. Kept as an
 * interface (rather than importing the class) so the panel can be
 * dynamically imported (design spec §6.3 "`ui:"dev"`のときのみ動的import")
 * without a load-time dependency cycle, and unit-tested against a fake host.
 */
export interface DevPanelHost {
  getState(): State;
  setConfig(partial: Partial<LiveParams>): void;
  play(): void;
  pause(): void;
  listPresets(): string[];
  applyPreset(name: string): void;
  on<K extends MahaEvent>(event: K, cb: (payload: MahaEventMap[K]) => void): () => void;
}

const MODE_LABELS: Record<Mode, string> = { 0: 'smooth', 1: 'wave', 2: 'capillary', 3: 'particle' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function labeledRow(labelText: string, control: HTMLElement): HTMLElement {
  const row = el('label', 'maha-devpanel-row');
  const span = el('span');
  span.textContent = labelText; // textContent only — never innerHTML (design spec §14)
  row.append(span, control);
  return row;
}

/**
 * Mount the dev control panel into `container` (a thin, non-authoritative
 * binding to live params — it holds no rendering-affecting state itself,
 * per design spec §6.3). Returns an unmount function.
 */
export function mountDevPanel(container: HTMLElement, host: DevPanelHost): () => void {
  const root = el('div', 'maha-devpanel');
  root.style.font = '12px sans-serif';
  root.style.display = 'grid';
  root.style.gap = '4px';
  root.style.padding = '8px';

  const unsubscribers: Array<() => void> = [];

  const clusterCount = el('input');
  clusterCount.type = 'range';
  clusterCount.min = '2';
  clusterCount.max = String(host.getState().clusters.length);
  clusterCount.addEventListener('input', () => host.setConfig({ clusterCount: Number(clusterCount.value) }));

  const spread = numberSlider(0.2, 3, 0.01, (v) => host.setConfig({ spread: v }));
  const anisotropy = numberSlider(0.05, 1, 0.01, (v) => host.setConfig({ anisotropy: v }));
  const softness = numberSlider(0.1, 3, 0.01, (v) => host.setConfig({ softness: v }));
  const zoom = numberSlider(0.25, 12, 0.05, (v) => host.setConfig({ zoom: v }));

  const modeSelect = el('select');
  for (const [value, label] of Object.entries(MODE_LABELS)) {
    const opt = el('option');
    opt.value = value;
    opt.textContent = label;
    modeSelect.appendChild(opt);
  }
  modeSelect.addEventListener('change', () => host.setConfig({ mode: Number(modeSelect.value) as Mode }));

  const playToggle = el('button');
  playToggle.type = 'button';
  const syncPlayLabel = (playing: boolean) => {
    playToggle.textContent = playing ? 'Pause' : 'Play';
  };
  playToggle.addEventListener('click', () => {
    if (host.getState().playing) host.pause();
    else host.play();
  });

  const presetSelect = el('select');
  for (const name of host.listPresets()) {
    const opt = el('option');
    opt.value = name;
    opt.textContent = name;
    presetSelect.appendChild(opt);
  }
  const applyPresetButton = el('button');
  applyPresetButton.type = 'button';
  applyPresetButton.textContent = 'Apply preset';
  applyPresetButton.addEventListener('click', () => host.applyPreset(presetSelect.value));

  root.append(
    labeledRow('Clusters', clusterCount),
    labeledRow('Spread', spread),
    labeledRow('Anisotropy', anisotropy),
    labeledRow('Softness', softness),
    labeledRow('Zoom', zoom),
    labeledRow('Mode', modeSelect),
    playToggle,
    labeledRow('Preset', presetSelect),
    applyPresetButton,
  );

  const syncFromState = (state: State) => {
    clusterCount.value = String(state.clusterCount);
    spread.value = String(state.spread);
    anisotropy.value = String(state.anisotropy);
    softness.value = String(state.softness);
    zoom.value = String(state.zoom);
    modeSelect.value = String(state.mode);
    syncPlayLabel(state.playing);
  };
  syncFromState(host.getState());
  unsubscribers.push(host.on('statechange', syncFromState));

  container.appendChild(root);

  return () => {
    for (const unsub of unsubscribers) unsub();
    root.remove();
  };
}

function numberSlider(min: number, max: number, step: number, onChange: (v: number) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.addEventListener('input', () => onChange(Number(input.value)));
  return input;
}
