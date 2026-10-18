import { estimateProgram } from '../core/cam/estimate';
import type { BitProgram } from '../core/cam/program';
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

/** One file per bit, numbered in cutting order: `owl_01_vbit-60.nc`. */
export function buildExportFiles(
  programs: BitProgram[],
  job: Job,
  machine: MachineConfig,
  jobName: string,
  post: PostProcessor,
): ExportFile[] {
  const base = slugify(jobName);
  const materialName = findMaterial(job.materialId)?.name ?? job.materialId;
  return programs.map((program, i) => {
    const name = `${base}_${String(i + 1).padStart(2, '0')}_${bitSlug(program.bit)}.${post.fileExtension}`;
    const text = post.render(program, {
      machine,
      fileName: name,
      materialName,
      stock: job.stock,
      originLabel: job.origin.replace('-', ' '),
      fileIndex: i + 1,
      fileCount: programs.length,
      estimatedSeconds: estimateProgram(program, machine).seconds,
      appVersion: APP_VERSION,
    });
    return { name, text };
  });
}

function downloadBlob(name: string, blob: Blob): void {
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
