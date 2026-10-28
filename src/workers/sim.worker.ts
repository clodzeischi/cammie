/// <reference lib="webworker" />
import { generateJob } from '../core/cam/generateJob';
import type { Job } from '../core/job/job';
import type { MachineConfig } from '../core/machine/machineConfig';
import type { FeedOverrides } from '../core/materials/feedOverrides';
import { SOLID_EPSILON } from '../core/sim/heightField';
import { findParts } from '../core/sim/looseParts';
import { simulateJob } from '../core/sim/simulateJob';
import { buildStockMeshes, type MeshData, type StockMeshes } from '../core/sim/stockMesh';
import type { Bit } from '../core/tools/bits';

/** Everything the CAM needs, so the worker can make the toolpaths itself. */
export interface CarveInput {
  job: Job;
  machine: MachineConfig;
  bits: Bit[];
  feedOverrides: FeedOverrides;
}

export interface SimRequest {
  id: number;
  input: CarveInput;
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

// Thin shell: the work happens in core/cam and core/sim. Making the
// toolpaths here too keeps the page smooth while a shape is being dragged.
self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { id, input, maxCells } = event.data;
  const { programs } = generateJob(input.job, input.machine, input.bits, input.feedOverrides);
  const field = simulateJob(input.job, programs, maxCells);
  const meshes = buildStockMeshes(field, findParts(field));
  const maxSpoil = field.spoil.reduce((deepest, v) => Math.max(deepest, v), 0);
  const response: SimResponse = {
    id,
    meshes,
    maxSpoil,
    spoilMask: Uint8Array.from(field.spoil, (v) => (v > SOLID_EPSILON ? 1 : 0)),
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
