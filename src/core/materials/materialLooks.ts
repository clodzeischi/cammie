/**
 * How each material looks in the 3D preview (SPEC.md §10.1). The patterns are
 * drawn by a shader from the position in the stock, so cut walls and pocket
 * floors show what's inside (plywood's layers, MDF's core). Colours are sRGB hex.
 */
export interface MaterialLook {
  pattern: 'wood' | 'plywood' | 'mdf' | 'plain' | 'brushed' | 'foam';
  /** Main colour: the face of the board. */
  color: string;
  /** Second colour: grain, glue lines, core, or pores. */
  accent: string;
  /** Growth rings per mm across the grain (wood patterns). */
  grain: number;
  roughness: number;
  metalness: number;
  /** Below 1 lets light through (acrylic). */
  opacity: number;
}

const look = (patch: Partial<MaterialLook> & Pick<MaterialLook, 'pattern' | 'color'>) => ({
  accent: patch.color,
  grain: 0.3,
  roughness: 0.8,
  metalness: 0,
  opacity: 1,
  ...patch,
});

export const MATERIAL_LOOKS: Record<string, MaterialLook> = {
  softwood: look({ pattern: 'wood', color: '#e6c690', accent: '#b9864c', grain: 0.22 }),
  hardwood: look({ pattern: 'wood', color: '#9c6b43', accent: '#5e3a20', grain: 0.45 }),
  plywood: look({ pattern: 'plywood', color: '#ead6ad', accent: '#c4a06b', grain: 0.35 }),
  mdf: look({ pattern: 'mdf', color: '#c39a69', accent: '#9b7346', roughness: 0.9 }),
  acrylic: look({
    pattern: 'plain',
    color: '#d6ecf2',
    roughness: 0.15,
    opacity: 0.8,
  }),
  hdpe: look({ pattern: 'plain', color: '#f4f3ee', accent: '#e4e2da', roughness: 0.6 }),
  aluminum: look({
    pattern: 'brushed',
    color: '#c9cdd2',
    accent: '#a7acb3',
    roughness: 0.35,
    metalness: 0.85,
  }),
  foam: look({ pattern: 'foam', color: '#e3e3c3', accent: '#b8b88f', roughness: 0.95 }),
};

const FALLBACK = look({ pattern: 'plain', color: '#d8c3a0' });

export const lookOf = (materialId: string): MaterialLook => MATERIAL_LOOKS[materialId] ?? FALLBACK;
