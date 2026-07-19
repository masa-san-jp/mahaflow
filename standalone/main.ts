import '../src/element/maha-flow';

/**
 * Standalone appreciation build (design spec §1 成果物2, T-S05): registers
 * `<maha-flow>` and mounts one full-viewport instance with the built-in dev
 * UI and autoplay enabled, so the built HTML runs by double-clicking alone.
 * `?seed=` overrides the default seed for variety across opens.
 */
function mount(): void {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') ?? '42';

  document.body.style.margin = '0';
  document.body.style.height = '100vh';
  document.body.style.background = '#05070a';
  document.body.style.overflow = 'hidden';

  const el = document.createElement('maha-flow');
  el.setAttribute('seed', seed);
  el.setAttribute('ui', 'dev');
  el.setAttribute('autoplay', JSON.stringify({ interval: 20, sequence: 'randomize' }));
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.width = '100vw';
  el.style.height = '100vh';

  document.body.appendChild(el);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
