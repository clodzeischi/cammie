import type { MachineConfig } from '../../machine/machineConfig';

/**
 * Checks generated G-code against the rules in SPEC.md §12.3. Used by tests
 * as a safety net: everything Cammie writes must pass.
 */
export function lintGcode(text: string, machine: MachineConfig): string[] {
  const problems: string[] = [];
  const allowedG = new Set(['0', '1', '2', '3', '4', '17', '21', '90', '94']);
  const allowedM = new Set(['2', '3', '5']);
  let z = 0;
  let movedXY = false;
  let raisedFirst = false;

  text.split('\n').forEach((raw, index) => {
    const lineNo = index + 1;
    const report = (msg: string) => problems.push(`line ${lineNo}: ${msg} → ${raw}`);
    if (/[^\x20-\x7e]/.test(raw)) report('non-ASCII character');

    const open = (raw.match(/\(/g) ?? []).length;
    const close = (raw.match(/\)/g) ?? []).length;
    if (open !== close || /\([^)]*\(/.test(raw)) report('unbalanced or nested comment');
    if (raw.includes(';')) report('semicolon comment');

    const code = raw
      .replace(/\([^)]*\)/g, '')
      .trim()
      .toUpperCase();
    if (code === '') return;
    if (code.startsWith('$')) report('GRBL system command');

    const words: string[] = code.match(/[A-Z]-?[\d.]+/g) ?? [];
    let motion = false;
    let hasXY = false;
    for (const word of words) {
      const letter = word[0]!;
      const value = word.slice(1);
      if (letter === 'G' && !allowedG.has(value)) report(`G${value} is not allowed`);
      if (letter === 'M' && !allowedM.has(value)) report(`M${value} is not allowed`);
      if (letter === 'T') report('tool change word');
      if (letter === 'G' && ['0', '1'].includes(value)) motion = true;
      if (letter === 'X' || letter === 'Y') hasXY = true;
      if (letter === 'F' && Number(value) > Math.max(machine.maxFeedXY, machine.maxFeedZ)) {
        report('feed above machine max');
      }
      if (letter === 'Z') {
        const nextZ = Number(value);
        if (motion && words.includes('G0') && nextZ < 0) report('rapid into material');
        if (!movedXY && !raisedFirst && nextZ > 0) raisedFirst = true;
        z = nextZ;
      }
    }
    if (motion && hasXY) {
      if (!raisedFirst) report('X/Y move before the first raise to safe Z');
      if (words[0] === 'G0' && z < 0) report('rapid X/Y move below the material surface');
      movedXY = true;
    }
  });
  return problems;
}
