/**
 * The bundled fonts (SPEC.md §6.1): free (SIL Open Font License) Google Fonts,
 * picked to cover sign-making styles. The font files themselves are loaded on
 * demand by the UI.
 */
export interface FontInfo {
  id: string;
  name: string;
  category: 'Sans' | 'Serif' | 'Script' | 'Stencil & display' | 'Mono';
}

export const FONTS: readonly FontInfo[] = [
  { id: 'roboto', name: 'Roboto', category: 'Sans' },
  { id: 'montserrat', name: 'Montserrat', category: 'Sans' },
  { id: 'oswald', name: 'Oswald', category: 'Sans' },
  { id: 'bebas-neue', name: 'Bebas Neue', category: 'Sans' },
  { id: 'merriweather', name: 'Merriweather', category: 'Serif' },
  { id: 'playfair-display', name: 'Playfair Display', category: 'Serif' },
  { id: 'roboto-slab', name: 'Roboto Slab', category: 'Serif' },
  { id: 'pacifico', name: 'Pacifico', category: 'Script' },
  { id: 'dancing-script', name: 'Dancing Script', category: 'Script' },
  { id: 'great-vibes', name: 'Great Vibes', category: 'Script' },
  { id: 'lobster', name: 'Lobster', category: 'Script' },
  { id: 'black-ops-one', name: 'Black Ops One', category: 'Stencil & display' },
  { id: 'allerta-stencil', name: 'Allerta Stencil', category: 'Stencil & display' },
  { id: 'stardos-stencil', name: 'Stardos Stencil', category: 'Stencil & display' },
  { id: 'permanent-marker', name: 'Permanent Marker', category: 'Stencil & display' },
  { id: 'source-code-pro', name: 'Source Code Pro', category: 'Mono' },
];

export const DEFAULT_FONT_ID = 'roboto';

export const findFont = (id: string): FontInfo | undefined => FONTS.find((f) => f.id === id);
