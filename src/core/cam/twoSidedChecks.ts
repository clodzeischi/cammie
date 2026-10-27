import { distanceToFlipLine, faceOf } from '../job/faces';
import type { Job } from '../job/job';
import { objectCentre } from '../job/registration';
import type { Diagnostic } from './program';

/** A pin hole may sit this far off the flip line (mm) and still line up. */
const ON_LINE_TOLERANCE = 0.05;

/**
 * Two-sided jobs only line up if the flipped stock goes back in the same
 * place: there should be registration holes, and they must sit on the flip line.
 */
export function checkTwoSided(job: Job, out: Diagnostic[]): void {
  const pins = job.objects.filter((o) => o.role === 'registration');
  const cutPins = pins.filter((o) =>
    job.toolpaths.some((t) => t.objectId === o.id && faceOf(t) === 'top'),
  );
  const flips = job.toolpaths.some((t) => faceOf(t) === 'bottom');

  if (flips && cutPins.length === 0) {
    out.push({
      severity: 'warning',
      message:
        'Some cuts are on the bottom. Add registration holes (Toolpaths → Registration holes) so the stock goes back in the same place after flipping it.',
    });
  }
  for (const pin of pins) {
    if (distanceToFlipLine(objectCentre(pin), job.stock, job.flip) > ON_LINE_TOLERANCE) {
      out.push({
        severity: 'warning',
        message: `${pin.name}: isn't on the flip line, so the stock won't line up after flipping. Use "Registration holes" again to put the holes back.`,
        objectId: pin.id,
      });
    }
  }
}
