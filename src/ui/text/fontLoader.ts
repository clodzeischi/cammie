import type { Font } from 'opentype.js';
import roboto from '@fontsource/roboto/files/roboto-latin-400-normal.woff?url';
import montserrat from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url';
import oswald from '@fontsource/oswald/files/oswald-latin-400-normal.woff?url';
import bebasNeue from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff?url';
import merriweather from '@fontsource/merriweather/files/merriweather-latin-400-normal.woff?url';
import playfairDisplay from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff?url';
import robotoSlab from '@fontsource/roboto-slab/files/roboto-slab-latin-400-normal.woff?url';
import pacifico from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url';
import dancingScript from '@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff?url';
import greatVibes from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff?url';
import lobster from '@fontsource/lobster/files/lobster-latin-400-normal.woff?url';
import blackOpsOne from '@fontsource/black-ops-one/files/black-ops-one-latin-400-normal.woff?url';
import allertaStencil from '@fontsource/allerta-stencil/files/allerta-stencil-latin-400-normal.woff?url';
import stardosStencil from '@fontsource/stardos-stencil/files/stardos-stencil-latin-400-normal.woff?url';
import permanentMarker from '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff?url';
import sourceCodePro from '@fontsource/source-code-pro/files/source-code-pro-latin-400-normal.woff?url';

/**
 * Font files (Latin, regular weight) from the Fontsource packages. Vite turns
 * each import into a URL, so a font is only downloaded once it's used.
 */
const FONT_URLS: Record<string, string> = {
  roboto,
  montserrat,
  oswald,
  'bebas-neue': bebasNeue,
  merriweather,
  'playfair-display': playfairDisplay,
  'roboto-slab': robotoSlab,
  pacifico,
  'dancing-script': dancingScript,
  'great-vibes': greatVibes,
  lobster,
  'black-ops-one': blackOpsOne,
  'allerta-stencil': allertaStencil,
  'stardos-stencil': stardosStencil,
  'permanent-marker': permanentMarker,
  'source-code-pro': sourceCodePro,
};

export const hasFontFile = (id: string) => id in FONT_URLS;

const cache = new Map<string, Promise<Font>>();

/** Downloads and parses a bundled font once; later calls share the result. */
export function loadFont(id: string): Promise<Font> {
  let font = cache.get(id);
  if (!font) {
    font = fetchFont(id);
    // Let a failed download (offline, say) be retried next time.
    font.catch(() => cache.delete(id));
    cache.set(id, font);
  }
  return font;
}

async function fetchFont(id: string): Promise<Font> {
  const url = FONT_URLS[id];
  if (!url) throw new Error(`Unknown font: ${id}`);
  const [response, opentype] = await Promise.all([fetch(url), import('opentype.js')]);
  if (!response.ok) throw new Error(`Couldn't download the font (${response.status})`);
  return opentype.parse(await response.arrayBuffer());
}
