import type { Path, Vec2 } from '../core/geometry/path';
import type {
  DesignObject,
  FlipAxis,
  Job,
  Operation,
  ShapeParams,
  Toolpath,
} from '../core/job/job';
import { defaultOperation, defaultTabs } from '../core/job/objectFactory';
import type { Bit } from '../core/tools/bits';
import { reviveJobPrefs } from './jobPrefsRepository';
import { reviveCustomBits } from './toolingRepositories';

/** A design saved to a `.cammie` file (SPEC.md §13.4). */
export interface Project {
  jobName: string;
  job: Job;
  /** The custom bits the toolpaths use, so the file opens on another computer. */
  bits: Bit[];
}

export const PROJECT_FORMAT = 'cammie-project';
export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = '.cammie';

export function serializeProject({ jobName, job, bits }: Project): string {
  const used = new Set(job.toolpaths.map((t) => t.operation.bitId));
  const file = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    jobName,
    job,
    bits: bits.filter((b) => used.has(b.id)),
  };
  return JSON.stringify(file);
}

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string };

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';
const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T =>
  options.includes(v as T);

/** Thrown inside the reviver; turned into a readable error by parseProject. */
class BadFile extends Error {}
const need = <T>(value: T | null | undefined | false, what: string): T => {
  if (value === null || value === undefined || value === false) throw new BadFile(what);
  return value;
};

const revivePoint = (p: unknown): Vec2 =>
  need(isObject(p) && finite(p.x) && finite(p.y) && { x: p.x, y: p.y }, 'a point');

function revivePath(p: unknown): Path {
  need(isObject(p) && Array.isArray(p.points), 'an outline');
  const { closed, points } = p as Loose;
  return { closed: closed === true, points: (points as unknown[]).map(revivePoint) };
}

function reviveShape(s: unknown): ShapeParams | undefined {
  if (!isObject(s)) return undefined;
  if (s.type === 'rect' && finite(s.width) && finite(s.height) && finite(s.cornerRadius)) {
    return { type: 'rect', width: s.width, height: s.height, cornerRadius: s.cornerRadius };
  }
  if (s.type === 'ellipse' && finite(s.width) && finite(s.height)) {
    return { type: 'ellipse', width: s.width, height: s.height };
  }
  if (
    s.type === 'text' &&
    str(s.text) &&
    str(s.fontId) &&
    finite(s.capHeight) &&
    finite(s.letterSpacing) &&
    finite(s.lineSpacing) &&
    oneOf(s.align, ['left', 'center', 'right'] as const)
  ) {
    const { text, fontId, capHeight, letterSpacing, lineSpacing, align } = s;
    return { type: 'text', text, fontId, capHeight, letterSpacing, lineSpacing, align };
  }
  // Unknown shape params: the object keeps its outlines but can't be edited as a shape.
  return undefined;
}

const KINDS: readonly DesignObject['kind'][] = ['traced-image', 'svg', 'text', 'rect', 'ellipse'];

function reviveObject(o: unknown): DesignObject {
  need(isObject(o) && str(o.id) && str(o.name) && oneOf(o.kind, KINDS), 'a design object');
  const obj = o as Loose;
  const t = need(isObject(obj.transform) && (obj.transform as Loose), 'an object position');
  const keys = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;
  need(
    keys.every((k) => finite(t[k])) && finite(obj.width) && finite(obj.height),
    'an object size',
  );
  const shape = reviveShape(obj.shape);
  return {
    id: obj.id as string,
    name: obj.name as string,
    kind: shape ? shape.type : (obj.kind as DesignObject['kind']),
    ...(shape && { shape }),
    ...(str(obj.groupId) && { groupId: obj.groupId }),
    ...(obj.role === 'registration' && { role: 'registration' as const }),
    paths: need(Array.isArray(obj.paths) && (obj.paths as unknown[]), 'outlines').map(revivePath),
    width: obj.width as number,
    height: obj.height as number,
    transform: {
      x: t.x as number,
      y: t.y as number,
      rotation: t.rotation as number,
      scaleX: t.scaleX as number,
      scaleY: t.scaleY as number,
    },
  };
}

/** Fills settings missing from older files with today's defaults. */
function reviveOperation(op: unknown): Operation {
  need(isObject(op) && str(op.bitId) && finite(op.depth), 'a cut');
  const o = op as Loose;
  const base = defaultOperation();
  const shared = {
    bitId: o.bitId as string,
    depth: o.depth as number,
    direction: oneOf(o.direction, ['climb', 'conventional'] as const)
      ? o.direction
      : base.direction,
    entry: oneOf(o.entry, ['ramp', 'plunge'] as const) ? o.entry : base.entry,
    finishing:
      isObject(o.finishing) && finite(o.finishing.allowance)
        ? { enabled: o.finishing.enabled === true, allowance: o.finishing.allowance }
        : base.finishing,
  };
  if (o.type === 'pocket' || o.type === 'drill') return { ...shared, type: o.type };
  if (o.type === 'chamfer' && oneOf(o.side, ['outside', 'inside'] as const)) {
    return { ...shared, type: 'chamfer', side: o.side };
  }
  need(o.type === 'profile' && oneOf(o.side, ['on', 'outside', 'inside'] as const), 'a cut type');
  const tabs = isObject(o.tabs) ? o.tabs : {};
  const auto = defaultTabs();
  return {
    ...shared,
    type: 'profile',
    side: o.side as 'on' | 'outside' | 'inside',
    tabs: {
      enabled: tabs.enabled !== false,
      count: finite(tabs.count) ? tabs.count : null,
      width: finite(tabs.width) ? tabs.width : null,
      height: finite(tabs.height) ? tabs.height : auto.height,
      manual: Array.isArray(tabs.manual) ? tabs.manual.map(revivePoint) : null,
    },
  };
}

function reviveToolpath(t: unknown, objectIds: ReadonlySet<string>): Toolpath | null {
  need(isObject(t) && str(t.id) && str(t.objectId), 'a toolpath');
  const tp = t as Loose;
  // A cut whose object is gone has nothing to cut; drop it rather than refuse the file.
  if (!objectIds.has(tp.objectId as string)) return null;
  return {
    id: tp.id as string,
    objectId: tp.objectId as string,
    operation: reviveOperation(tp.operation),
    ...(tp.face === 'bottom' && { face: 'bottom' as const }),
  };
}

/**
 * Reads a `.cammie` file. Anything malformed is rejected with a message
 * rather than half-loaded, so a bad file can never leave a broken design.
 */
export function parseProject(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This isn't a Cammie project file." };
  }
  if (!isObject(data) || data.format !== PROJECT_FORMAT) {
    return { ok: false, error: "This isn't a Cammie project file." };
  }
  if (!finite(data.version) || data.version > PROJECT_VERSION) {
    return {
      ok: false,
      error: 'This project was saved by a newer version of Cammie. Reload the page to update.',
    };
  }
  try {
    const job = need(isObject(data.job) && (data.job as Loose), 'the job');
    const prefs = reviveJobPrefs(job);
    const objects = need(Array.isArray(job.objects) && (job.objects as unknown[]), 'objects').map(
      reviveObject,
    );
    const ids = new Set(objects.map((o) => o.id));
    const toolpaths = need(Array.isArray(job.toolpaths) && (job.toolpaths as unknown[]), 'cuts')
      .map((t) => reviveToolpath(t, ids))
      .filter((t): t is Toolpath => t !== null);
    const flip: FlipAxis = job.flip === 'top-bottom' ? 'top-bottom' : 'left-right';
    return {
      ok: true,
      project: {
        jobName: str(data.jobName) ? data.jobName : '',
        job: { ...prefs, objects, toolpaths, flip },
        bits: reviveCustomBits(data.bits),
      },
    };
  } catch (error) {
    if (!(error instanceof BadFile)) throw error;
    return {
      ok: false,
      error: `This project file is damaged (${error.message} couldn't be read).`,
    };
  }
}
