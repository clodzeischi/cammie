import { boundsOfPaths, type Vec2 } from '../geometry/path';
import { transformPaths } from '../geometry/transform';
import { createShapeObject } from '../shapes/shapeObjects';
import type { DesignObject, FlipAxis, ProfileOperation, Stock } from './job';
import { defaultOperation, defaultTabs } from './objectFactory';

/** 6 mm dowel pins are cheap and common; 1/4" ones fit a 6.35 mm hole. */
export const DEFAULT_PIN_DIAMETER = 6;
/** How far the holes go into the spoilboard, so the pins stay put when the stock is lifted off. */
export const PIN_DEPTH_INTO_SPOILBOARD = 3;
/** Material kept between a hole and the end of the stock (mm). */
const EDGE_MARGIN = 5;

/** Centres of the two pin holes: on the flip line, near each end of it. */
export function pinCentres(stock: Stock, flip: FlipAxis, diameter: number): [Vec2, Vec2] {
  const inset = diameter / 2 + EDGE_MARGIN;
  return flip === 'left-right'
    ? [
        { x: stock.width / 2, y: inset },
        { x: stock.width / 2, y: stock.height - inset },
      ]
    : [
        { x: inset, y: stock.height / 2 },
        { x: stock.width - inset, y: stock.height / 2 },
      ];
}

/**
 * Two round holes on the flip line, cut through the stock into the
 * spoilboard. Dowel pins in them put the flipped stock back in exactly the
 * same place, because each hole lands on itself when the stock turns over.
 */
export function registrationHoles(
  stock: Stock,
  flip: FlipAxis,
  diameter: number,
  newId: () => string,
): DesignObject[] {
  return pinCentres(stock, flip, diameter).map((centre, i) => {
    const circle = createShapeObject(
      newId(),
      { type: 'ellipse', width: diameter, height: diameter },
      stock,
    );
    return {
      ...circle,
      name: `Registration hole ${i + 1}`,
      role: 'registration',
      transform: { ...circle.transform, x: centre.x - diameter / 2, y: centre.y - diameter / 2 },
    };
  });
}

/** The cut for a registration hole: a hole of the drawn size, through into the spoilboard. */
export function registrationCut(stock: Stock, bitId: string): ProfileOperation {
  return {
    ...defaultOperation(),
    side: 'inside',
    bitId,
    depth: stock.thickness + PIN_DEPTH_INTO_SPOILBOARD,
    tabs: { ...defaultTabs(), enabled: false },
  };
}

/** Where an object's outline is centred on the canvas. */
export function objectCentre(object: DesignObject): Vec2 {
  const b = boundsOfPaths(transformPaths(object.paths, object.transform));
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}
