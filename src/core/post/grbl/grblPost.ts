import { formatDuration } from '../../cam/estimate';
import type { BitProgram, Move } from '../../cam/program';
import { rpmToSValue } from '../../machine/machineConfig';
import type { Bit } from '../../tools/bits';
import type { PostContext, PostProcessor } from '../PostProcessor';
import { comment, formatCoord, formatInt, userLines } from './formatting';

/** Tracks what the controller already knows, so unchanged words are left out. */
class ModalWriter {
  readonly lines: string[] = [];
  // Files start with the bit hand-zeroed at X0 Y0 Z0 (SPEC.md §12.3).
  private x = 0;
  private y = 0;
  private z = 0;
  private feed: number | null = null;

  line(text: string) {
    this.lines.push(text);
  }

  move(move: Move) {
    const words: string[] = [move.kind === 'rapid' ? 'G0' : 'G1'];
    const axis = (name: string, from: number, to: number) => {
      if (formatCoord(from) !== formatCoord(to)) words.push(name + formatCoord(to));
    };
    axis('X', this.x, move.x);
    axis('Y', this.y, move.y);
    axis('Z', this.z, move.z);
    if (words.length === 1) return; // no motion

    if (move.kind === 'feed' && move.feed !== this.feed) {
      words.push('F' + formatInt(move.feed!));
      this.feed = move.feed!;
    }
    this.x = move.x;
    this.y = move.y;
    this.z = move.z;
    this.line(words.join(' '));
  }

  /** Straight up to `z` without moving X/Y. */
  raise(z: number) {
    this.move({ kind: 'rapid', x: this.x, y: this.y, z });
  }
}

const describeBit = (bit: Bit) =>
  bit.type === 'vbit' ? `${bit.name}, tip ${bit.tipDiameter}mm` : `${bit.name}, ${bit.diameter}mm`;

/** GRBL 1.1 dialect for gSender and similar senders (SPEC.md §12). */
export const grblPost: PostProcessor = {
  id: 'grbl-1.1',
  fileExtension: 'nc',

  render(program: BitProgram, ctx: PostContext): string {
    const { machine } = ctx;
    const out = new ModalWriter();
    const { width, height, thickness } = ctx.stock;

    out.line(comment(`Cammie ${ctx.appVersion}: ${ctx.fileName}`));
    out.line(comment(`Bit: ${describeBit(program.bit)} | Material: ${ctx.materialName}`));
    out.line(
      comment(
        `Stock: ${width}x${height}x${thickness}mm | Origin: ${ctx.originLabel}, Z0 = top of material`,
      ),
    );
    if (ctx.fileCount > 1) {
      out.line(
        comment(
          `File ${ctx.fileIndex} of ${ctx.fileCount}: change the bit and re-zero Z before running`,
        ),
      );
    }
    out.line(comment(`Estimated time: ${formatDuration(ctx.estimatedSeconds)}`));
    out.line(comment('Start with the bit at X0 Y0, touching the top of the material'));
    out.line('G21 G90 G94 G17');
    userLines(machine.customHeader).forEach((l) => out.line(l));

    // First motion is always straight up, before any X/Y travel.
    out.raise(machine.safeZ);

    let rpm: number | null = null;
    for (const section of program.sections) {
      out.line(comment(section.label));
      if (section.rpm !== rpm) {
        const s = formatInt(rpmToSValue(section.rpm, machine));
        out.line(rpm === null ? `M3 S${s}` : `S${s}`);
        if (machine.spindleDwell > 0) out.line(`G4 P${machine.spindleDwell}`);
        rpm = section.rpm;
      }
      section.moves.forEach((m) => out.move(m));
    }

    out.raise(machine.safeZ);
    userLines(machine.customFooter).forEach((l) => out.line(l));
    out.line('M5');
    const end = machine.endPosition;
    if (end.mode === 'origin') out.move({ kind: 'rapid', x: 0, y: 0, z: machine.safeZ });
    if (end.mode === 'park') out.move({ kind: 'rapid', x: end.x, y: end.y, z: machine.safeZ });
    out.line('M2');

    return out.lines.join('\n') + '\n';
  },
};
