/// <reference lib="webworker" />
import type { BitProgram } from '../core/cam/program';
import type { Job } from '../core/job/job';
import { SOLID_EPSILON } from '../core/sim/heightField';
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
  /** Per cell (row by row, from the stock's top-left): 1 where a cut reached the spoilboard. */
  spoilMask: Uint8Array;
  cols: number;
  rows: number;
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
  const spoilMask = field.spoil.map((v) => (v > SOLID_EPSILON ? 1 : 0));
  const response: SimResponse = {
    id,
    meshes,
    maxSpoil,
    spoilMask: Uint8Array.from(spoilMask),
    cols: field.cols,
    rows: field.rows,
    cell: field.cell,
  };
  self.postMessage(response, [
    response.spoilMask.buffer,
    ...buffers(meshes.board),
    ...meshes.loose.flatMap((l) => buffers(l.mesh)),
  ]);
};
