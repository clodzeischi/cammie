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

/** Browsers may ask once before allowing several downloads from one click. */
export function downloadFiles(files: ExportFile[]): void {
  files.forEach((file, i) => {
    setTimeout(() => {
      const url = URL.createObjectURL(new Blob([file.text], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, i * 300);
  });
}
