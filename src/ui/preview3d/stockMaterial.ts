import * as THREE from 'three';
import type { MaterialLook } from '../../core/materials/materialLooks';

const PATTERNS: Record<MaterialLook['pattern'], number> = {
  wood: 0,
  plywood: 1,
  mdf: 2,
  plain: 3,
  brushed: 4,
  foam: 5,
};

/** Plywood sheets have an odd number of plies, each roughly this thick (mm). */
const PLY_THICKNESS = 1.5;

/** Plies in a sheet this thick: odd, at least 3. */
export function plyCount(thickness: number): number {
  const n = Math.max(3, Math.round(thickness / PLY_THICKNESS));
  return n % 2 === 1 ? n : n + 1;
}

/*
 * Colour from the point's position in the stock (mm; z = 0 on top, −thickness
 * underneath). Grain runs along X; plywood's inner plies alternate direction.
 */
const PATTERN_GLSL = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uAccent;
uniform int uPattern;
uniform float uGrain;
uniform float uThickness;
uniform float uPlies;
uniform vec3 uHighlight;
uniform float uHighlightAmount;
varying vec3 vStock;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
        mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
        mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm3(vec3 p) {
  return 0.55 * noise3(p) + 0.3 * noise3(p * 2.03) + 0.15 * noise3(p * 4.01);
}

// Long grain along q.x: rings bent by slow noise, plus fine streaks.
vec3 wood(vec3 q) {
  float warp = fbm3(q * vec3(0.015, 0.12, 0.12)) * 5.0;
  float rings = fract((q.y * 0.9 + q.z * 0.4 + warp) * uGrain);
  float late = smoothstep(0.55, 0.85, rings) * smoothstep(1.0, 0.9, rings);
  float streak = noise3(q * vec3(0.04, 2.5, 2.5));
  return mix(uBase, uAccent, clamp(late * 0.7 + streak * 0.18, 0.0, 1.0));
}

vec3 stockColor(vec3 p) {
  float depth = clamp(-p.z, 0.0, uThickness);
  if (uPattern == 0) return wood(p);
  if (uPattern == 1) {
    float ply = uThickness / uPlies;
    float index = floor(min(depth / ply, uPlies - 0.001));
    vec3 grain = mod(index, 2.0) < 0.5 ? wood(p) : wood(p.yxz);
    grain *= 0.94 + 0.1 * hash3(vec3(index, 3.1, 7.7));
    // Glue lines sit between plies only, not on the sheet's faces.
    float joint = clamp(floor(depth / ply + 0.5), 1.0, uPlies - 1.0) * ply;
    float glue = 1.0 - smoothstep(0.0, 0.07 * ply, abs(depth - joint));
    return mix(grain, uAccent * 0.55, glue * 0.7);
  }
  if (uPattern == 2) {
    float skin = 1.0 - smoothstep(0.25, 0.45, min(depth, uThickness - depth));
    vec3 core = mix(uAccent, uBase, noise3(p * 3.0) * 0.5);
    return mix(core, uBase, skin);
  }
  if (uPattern == 4) return mix(uAccent, uBase, 0.7 + 0.3 * noise3(p * vec3(0.03, 6.0, 6.0)));
  if (uPattern == 5) return mix(uBase, uAccent, smoothstep(0.62, 0.78, noise3(p * 2.2)));
  return mix(uBase, uAccent, noise3(p * 1.5) * 0.4);
}
`;

/** Loose pieces are blended this far toward the warning colour: still recognisably the material. */
const HIGHLIGHT_AMOUNT = 0.55;

/**
 * A lit material that paints the stock's look from each point's position, so
 * cut walls and pocket floors show the inside of the board. Positions are the
 * mesh's own (before any lift), so loose pieces keep their pattern; pass
 * `highlight` to tint one toward that colour.
 */
export function createStockMaterial(
  look: MaterialLook,
  thickness: number,
  highlight?: THREE.Color,
): THREE.Material {
  const material = new THREE.MeshStandardMaterial({
    roughness: look.roughness,
    metalness: look.metalness,
    transparent: look.opacity < 1,
    opacity: look.opacity,
  });
  const uniforms = {
    uBase: { value: new THREE.Color(look.color) },
    uAccent: { value: new THREE.Color(look.accent) },
    uPattern: { value: PATTERNS[look.pattern] },
    uGrain: { value: look.grain },
    uThickness: { value: thickness },
    uPlies: { value: plyCount(thickness) },
    uHighlight: { value: highlight ?? new THREE.Color() },
    uHighlightAmount: { value: highlight ? HIGHLIGHT_AMOUNT : 0 },
  };
  // The highlight colour can change with the theme without a new material.
  material.userData.highlight = uniforms.uHighlight.value;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStock;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStock = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PATTERN_GLSL}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n' +
          'diffuseColor.rgb = mix(stockColor(vStock), uHighlight, uHighlightAmount);',
      );
  };
  // Same program for every stock material; uniforms carry the differences.
  material.customProgramCacheKey = () => 'cammie-stock';
  return material;
}
