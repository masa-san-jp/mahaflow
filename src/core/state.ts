import type { LiveParams } from './config';
import type { GeneratedCluster } from '../math/cluster';

/**
 * Autoplay is P2 scope; the field is reserved on State now (design spec
 * §5) so getState()'s shape doesn't change again once autoplay lands.
 */
export type AutoplayState = false;

export interface State extends LiveParams {
  seed: number;
  frame: number;
  clusters: GeneratedCluster[];
  autoplay: AutoplayState;
}
