import { estimateProgram } from '../core/cam/estimate';
import type { BitProgram } from '../core/cam/program';
import { FLIP_LABEL } from '../core/job/faces';
import type { Job } from '../core/job/job';
import type { MachineConfig } from '../core/machine/machineConfig';
import { findMaterial } from '../core/materials/materials';
import type { PostProcessor } from '../core/post/PostProcessor';
import { bitSlug } from '../core/tools/bits';

export const APP_VERSION = `v${__APP_VERSION__}`;

export interface ExportFile {
  name: string;
  text: string;
}

/** "My Owl Logo!" → "my-owl-logo". Falls back to "cammie-job". */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'cammie-job';
}

/**
 * One file per bit and side, numbered in cutting order: `owl_01_vbit-60.nc`,
 * then `owl_02_bottom_flat-3.175.nc` once the stock is turned over.
 */
export function buildExportFiles(
  programs: BitProgram[],
  job: Job,
  machine: MachineConfig,
  jobName: string,
  post: PostProcessor,
): ExportFile[] {
  const base = slugify(jobName);
  const materialName = findMaterial(job.materialId)?.name ?? job.materialId;
  const firstBottom = programs.findIndex((p) => p.face === 'bottom');
  return programs.map((program, i) => {
    const side = program.face === 'bottom' ? 'bottom_' : '';
    const name = `${base}_${String(i + 1).padStart(2, '0')}_${side}${bitSlug(program.bit)}.${post.fileExtension}`;
    const text = post.render(program, {
      machine,
      fileName: name,
      materialName,
      stock: job.stock,
      originLabel: job.origin.replace('-', ' '),
      fileIndex: i + 1,
      fileCount: programs.length,
      ...(i === firstBottom && {
        setupNote: `bottom side. Turn the stock over ${FLIP_LABEL[job.flip]} onto the registration pins${
          i > 0 && programs[i - 1]!.bit.id !== program.bit.id ? ', change the bit' : ''
        } and re-zero Z only: keep X/Y zero where it is, the pins line the stock up with it`,
      }),
      estimatedSeconds: estimateProgram(program, machine).seconds,
      appVersion: APP_VERSION,
    });
    return { name, text };
  });
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Bundles several files into one zip, named after the job. */
export async function zipFiles(files: ExportFile[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  files.forEach((file) => zip.file(file.name, file.text));
  return zip.generateAsync({ type: 'blob' });
}

/** One file downloads as-is; several come as `<job>.zip` (SPEC.md §12.1). */
export async function downloadFiles(files: ExportFile[], jobName: string): Promise<void> {
  if (files.length === 0) return;
  if (files.length === 1) {
    downloadBlob(files[0]!.name, new Blob([files[0]!.text], { type: 'text/plain' }));
    return;
  }
  downloadBlob(`${slugify(jobName)}.zip`, await zipFiles(files));
}
