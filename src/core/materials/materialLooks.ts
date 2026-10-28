/** How each material looks in the 3D preview (SPEC.md §10.1). Colours are sRGB hex. */
export interface MaterialLook {
  /** The face of the board. */
  color: string;
}

export const MATERIAL_LOOKS: Record<string, MaterialLook> = {
  softwood: { color: '#e3c38f' },
  hardwood: { color: '#9c6b43' },
  mdf: { color: '#b98d5f' },
  plywood: { color: '#e8d2a8' },
  acrylic: { color: '#cfe3ea' },
  hdpe: { color: '#f2f1ec' },
  aluminum: { color: '#c3c7cc' },
  foam: { color: '#d9dcc4' },
};

const FALLBACK: MaterialLook = { color: '#d8c3a0' };

export const lookOf = (materialId: string): MaterialLook => MATERIAL_LOOKS[materialId] ?? FALLBACK;
