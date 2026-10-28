/// <reference lib="webworker" />
import type { BitProgram } from '../core/cam/program';
import type { Job } from '../core/job/job';
import { findParts } from '../core/sim/looseParts';
import { simulateJob } from '../core/sim/simulateJob';
import { buildStockMeshes, type MeshData, type StockMeshes } from '../core/sim/stockMesh';

export interface SimRequest {
  id: number;
  job: Pick<Job, 'stock' | 'origin' | 'flip'>;
  programs: BitProgram[];
  maxCells: number;
}

export interface SimResponse {
  id: number;
  meshes: StockMeshes;
  /** Deepest cut into the spoilboard (mm). */
  maxSpoil: number;
  /** Cell size used (mm), i.e. how fine the preview is. */
  cell: number;
}

const buffers = (m: MeshData) => [m.positions.buffer, m.normals.buffer, m.indices.buffer];

// Thin shell: all the work happens in core/sim.
self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { id, job, programs, maxCells } = event.data;
  const field = simulateJob(job, programs, maxCells);
  const meshes = buildStockMeshes(field, findParts(field));
  const maxSpoil = field.spoil.reduce((deepest, v) => Math.max(deepest, v), 0);
  const response: SimResponse = { id, meshes, maxSpoil, cell: field.cell };
  self.postMessage(response, [
    ...buffers(meshes.board),
    ...meshes.loose.flatMap((l) => buffers(l.mesh)),
  ]);
};
