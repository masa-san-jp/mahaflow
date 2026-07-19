import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CSSProperties } from 'react';
import { MahaFlowCore, type CoreDeps } from '../core/MahaFlowCore';
import type { InitConfig } from '../core/types';
import type { LiveParams, Warning } from '../core/config';
import type { State } from '../core/state';

export interface MahaFlowProps extends InitConfig {
  live?: Partial<LiveParams>;
  className?: string;
  style?: CSSProperties;
  onReady?: () => void;
  onStateChange?: (state: State) => void;
  onHover?: (payload: { D: number; x: number; y: number }) => void;
  onWarning?: (warning: Warning) => void;
  /** Test-only hook: inject a fake renderer (see test/contract/react.test.tsx). */
  coreDeps?: CoreDeps;
}

export interface MahaFlowHandle {
  readonly core: MahaFlowCore | null;
}

/**
 * Thin React wrapper (design spec §3.1 "react/MahaFlow.tsx"): mounts
 * MahaFlowCore into an owned div on mount, pushes `live` prop changes
 * through setConfig without remounting, and remounts only when an
 * init-only identity prop (seed/dims/maxClusters) changes.
 */
export const MahaFlow = forwardRef<MahaFlowHandle, MahaFlowProps>(function MahaFlow(props, ref) {
  const { live, className, style, onReady, onStateChange, onHover, onWarning, coreDeps, ...initConfig } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<MahaFlowCore | null>(null);
  const handlersRef = useRef({ onReady, onStateChange, onHover, onWarning });
  handlersRef.current = { onReady, onStateChange, onHover, onWarning };

  useImperativeHandle(ref, () => ({ get core() { return coreRef.current; } }), []);

  // Deliberately depends only on init-only identity props; live params are
  // pushed via setConfig in the effect below rather than triggering a remount.
  useEffect(() => {
    if (!containerRef.current) return;
    const core = new MahaFlowCore(containerRef.current, initConfig as InitConfig, coreDeps ?? {});
    coreRef.current = core;

    const unsubscribers = [
      core.on('statechange', (s) => handlersRef.current.onStateChange?.(s)),
      core.on('hover', (h) => handlersRef.current.onHover?.(h)),
      core.on('warning', (w) => handlersRef.current.onWarning?.(w)),
    ];
    core.ready.then(() => handlersRef.current.onReady?.());

    return () => {
      for (const unsub of unsubscribers) unsub();
      core.dispose();
      coreRef.current = null;
    };
  }, [initConfig.seed, initConfig.dims, initConfig.maxClusters]);

  useEffect(() => {
    if (live && coreRef.current) coreRef.current.setConfig(live);
  }, [live]);

  return <div ref={containerRef} className={className} style={style} />;
});
