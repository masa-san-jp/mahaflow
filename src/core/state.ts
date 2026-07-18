import type { LiveParams } from './config';
import type { GeneratedCluster } from '../math/cluster';
import type { AutoplayState } from './autoplay';

export type { AutoplayState };

export interface State extends LiveParams {
  seed: number;
  frame: number;
  clusters: GeneratedCluster[];
  autoplay: AutoplayState;
}
