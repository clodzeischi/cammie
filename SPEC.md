# Cammie — Product & Technical Spec

> A browser-based, Easel-style CAM app for hobby 3018 CNC routers running GRBL 1.1.
> Design in the browser → get `.nc` files → run them in gSender.

Status: Draft v1 · 2026-10-17

---

## 1. Goals

1. **Dead-simple workflow**: import SVG/PNG (or add text/shapes) → pick material & bit → pick operation → export G-code. No CAM vocabulary required to get a good first result.
2. **Correct, safe GRBL 1.1 output** that runs in gSender without edits.
3. **Runs anywhere a desktop browser runs** (Linux, macOS, Windows, ChromeOS, tablets). No install, no account.
4. **Static hosting only** (Firebase Hosting). All processing happens client-side.

## 2. Non-goals (v1)

| Out of scope | Why / alternative |
|---|---|
| Machine control / streaming (WebSerial) | gSender does this. |
| Project save/load, cloud storage, accounts | Only `.nc` export. Machine settings + custom bits persist locally. |
| DXF import | SVG and PNG only. |
| Laser support (M4, raster engraving) | Spindle-only machine. |
| 3D relief / heightmap carving, ball-nose bits | 2D / 2.5D only. |
| Mobile phone layout | Phones get a blocking message (see §11). Tablets are supported. |
| Inch units | mm everywhere, output is always `G21`. |
| 3D carve simulation | Planned for a later phase (§14), not v1. |
| Homing, probing, zeroing | The user zeros the bit by hand at the work origin. The `.nc` file only moves the mill (§12.3). |
| Spoilboard surfacing | Later phase (§14). |

---

## 3. Core Workflow & UI Layout

Modeled on Easel: one screen, left-to-right flow.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Cammie    [Material ▾] [Stock 200×150×6 mm] [Bit ▾]   [⚙ Machine] [Export]│
├────┬───────────────────────────────────────────────┬─────────────────────┤
│ ⬆  │                                               │  Selected object    │
│ T  │          Design canvas (stock rectangle,      │  ─────────────────  │
│ ▭  │          grid in mm, origin marker,           │  Position / size    │
│ ◯  │          machine work-area outline)           │  Operation  [▾]     │
│    │                                               │  Cut depth  [mm]    │
│    │                                               │  Bit        [▾]     │
│    │                                               │  Tabs  [on] count…  │
│    │                                               │  Advanced ▸         │
│    ├───────────────────────────────────────────────┤                     │
│    │ [Design] [Toolpath preview]   warnings (2) ⚠  │                     │
└────┴───────────────────────────────────────────────┴─────────────────────┘
```

- **Left toolbar**: Import (SVG/PNG), Text, Rectangle, Circle/Ellipse, (Polygon/Star optional later).
- **Canvas**: stock rectangle drawn to scale, mm grid, rulers, selectable origin marker, dashed outline of machine work area. Pan (space/middle-drag), zoom (wheel/pinch), snap to grid toggle.
- **Right panel**: properties of selected object(s); job settings when nothing is selected (stock, origin, material).
- **View toggle**: *Design* vs *Toolpath preview* (§10).
- **Warnings tray**: non-blocking issues (§9.6). Blocking errors disable Export with a reason.

### 3.1 Typical session
1. Set stock size & thickness, choose material (persisted as "last used").
2. Import an SVG, or type text.
3. Select objects → choose operation (Profile outside / inside / on-line, Pocket, V-carve), depth, bit.
4. Switch to *Toolpath preview*, check, then **Export** → downloads one `.nc` per bit.

---

## 4. Job Model

```ts
// Units: millimetres everywhere. Canvas Y-down internally; flipped to machine Y-up at post time.
interface Job {
  stock: { width: number; height: number; thickness: number };
  origin: OriginAnchor;          // where machine X0 Y0 sits on the stock
  materialId: string;
  objects: DesignObject[];       // z-ordered
}

type OriginAnchor =
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'center-left' | 'center'       | 'center-right'
  | 'top-left'    | 'top-center'   | 'top-right';
// Z0 is always the TOP of the material. All cuts are negative Z.

interface DesignObject {
  id: string;
  kind: 'svg' | 'traced-image' | 'text' | 'rect' | 'ellipse';
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
  geometry: PathSet;             // resolved, flattened paths in object-local mm
  source: unknown;               // kind-specific params (text string+font, rect w/h/radius, ...)
  operation: OperationSettings | null;   // null = not cut (guide/reference only)
}

interface PathSet { paths: Path[]; }
interface Path { points: Vec2[]; closed: boolean; }
```

- Editing source params (e.g. text content, rect size) regenerates `geometry`.
- Grouping: multi-select + group/ungroup; an operation can be applied to a group.
- Arrange: move, scale (lock aspect by default), rotate, duplicate, delete, align (left/center/right/top/middle/bottom), center on stock, undo/redo (in-memory command stack, ≥50 steps).

---

## 5. Import

### 5.1 SVG
- Parse with the browser's `DOMParser`; walk `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, honoring nested `transform`s and `viewBox`.
- `<text>` in SVG is **not** supported → warning "convert text to paths in your editor" (or use our text tool).
- Ignore fills/strokes styling; geometry only. Strokes are treated as centerline paths.
- **Scale**: honor `width`/`height` units (`mm`, `cm`, `in`, `pt`, `pc`, `px`) + `viewBox`. Unitless/px → assume 96 DPI. After import, user can type an exact width/height.
- Curves (cubic/quadratic Bézier, arcs) are flattened to polylines with a chord tolerance of **0.01 mm** (configurable in Advanced).
- Clean-up on import: join path segments whose endpoints are within 0.01 mm, mark as closed if start≈end, drop zero-length segments, drop duplicate points.
- Fill rule: respect `fill-rule` (`nonzero` / `evenodd`) when determining islands/holes for pockets and V-carve.

### 5.2 PNG (and JPG/WebP — browser decodes for free) → vector trace
- Import dialog with live preview:
  - **Threshold** slider (0–255) + **Invert** toggle; optional auto (Otsu).
  - **Despeckle** (drop blobs smaller than N px).
  - **Smoothing** (blur radius before tracing: higher = rounder outlines).
  - Target width in mm (height follows aspect), or DPI.
- Trace in a Web Worker with Cammie's own tracer (`src/core/trace`): blur the grayscale image slightly, run marching squares with sub-pixel interpolation (smooth outlines instead of pixel stairs), drop specks, then simplify (Ramer–Douglas–Peucker). Chosen over a Potrace port for readability and to avoid a GPL dependency; the output is polylines either way. Holes come out as separate closed loops.
- The new object is cropped to the artwork's bounding box, so its size and X/Y refer to the lines, not the image margins. "Artwork width" auto-fits 80% of the stock until the user types a value.
- The original bitmap can be shown faintly behind the trace for reference (not cut).

---

## 6. Design Tools

### 6.1 Text
- Font picker from a **bundled set of ~16 OFL Google Fonts**, lazy-loaded on first use. Proposed set (covering V-carve-friendly and stencil styles):
  - Sans: Roboto, Montserrat, Oswald, Bebas Neue
  - Serif: Merriweather, Playfair Display, Roboto Slab
  - Script: Pacifico, Dancing Script, Great Vibes, Lobster
  - Display/stencil: Black Ops One, Allerta Stencil, Stardos Stencil, Permanent Marker
  - Mono: Source Code Pro
- Properties: text (multi-line), font, size (cap height in mm), letter spacing, line spacing, alignment.
- Glyphs → paths via `opentype.js`; overlapping glyph contours (common in script fonts) are unioned with Clipper2 so pockets/V-carves don't double-cut.

### 6.2 Shapes
- Rectangle (w, h, corner radius), Ellipse/Circle (w, h). All parametric and editable numerically.

---

## 7. Tools (Bits)

### 7.1 Types
```ts
type Bit =
  | { id; name; type: 'flat';  diameter: number; flutes: number; fluteLength?: number }
  | { id; name; type: 'vbit';  angle: number; tipDiameter: number; diameter: number; flutes: number };
```
- **Built-in library** (read-only, typical 3018 bits, 1/8" shank):
  - Flat: 1.0, 1.5, 2.0, 3.175 mm (2-flute); 3.175 mm 1-flute (plastics).
  - V-bit: 20°, 30°, 60°, 90° (tip 0.1–0.2 mm, Ø 3.175 mm).
- **Custom bits**: add/edit/delete, stored in `localStorage`. Exportable/importable as JSON (nice-to-have).

### 7.2 Which bit can do what
| Operation | Flat end mill | V-bit |
|---|---|---|
| Profile (on/inside/outside) | ✅ | ✅ (on-line only — engraving lines) |
| Pocket | ✅ | ❌ |
| V-carve | ❌ | ✅ |

---

## 8. Materials & Feeds/Speeds

Presets are **conservative starting points for a stock 3018 (~10k RPM 775 spindle, flexible frame)**. Every value is overridable per job; overrides for a material+bit pair are remembered in `localStorage`.

Values per material for a **3.175 mm 2-flute flat**; other diameters scale (see below).

| Material | Feed (mm/min) | Plunge (mm/min) | Depth/pass (mm) | RPM | Stepover |
|---|---|---|---|---|---|
| Softwood (pine) | 700 | 250 | 1.0 | 10000 | 40% |
| Hardwood (oak, maple, walnut) | 450 | 150 | 0.5 | 10000 | 40% |
| MDF | 700 | 250 | 1.0 | 10000 | 45% |
| Plywood (birch) | 550 | 200 | 0.8 | 10000 | 40% |
| Acrylic (cast) — 1-flute preferred | 400 | 120 | 0.5 | 9000 | 35% |
| HDPE / plastics | 600 | 200 | 1.0 | 9000 | 40% |
| Aluminum (6061) — expert | 150 | 40 | 0.15 | 10000 | 20% |
| Foam / soft wax | 1200 | 400 | 3.0 | 8000 | 50% |

- **Diameter scaling**: depth/pass scales ∝ diameter (≈ 0.3×Ø for softwood, capped at the preset); feed scales ∝ diameter for Ø < 3.175 mm (smaller bits break), never above preset.
- **V-bits**: feed = 60% of the material's flat feed; plunge as preset; "depth/pass" for V-carve = the material's depth/pass (passes are stepped down when total depth exceeds it).
- All feeds are clamped to the machine's max feed (§9.1); RPM clamped to max RPM.
- Presets live in a single data file (`src/data/materials.ts`) so they're easy to tune.

---

## 9. CAM Operations

CAM is pure, synchronous TypeScript (`generateJob`), recomputed whenever the design, material or machine settings change. Phase 1's outline engraving is fast enough for the main thread; pocketing and V-carve (phases 3 and 5) move it into a **Web Worker** so the UI never freezes.

Common per-operation settings:
```ts
interface OperationSettings {
  type: 'profile' | 'pocket' | 'vcarve';
  bitId: string;
  depth: number;                  // total cut depth, mm (positive number; emitted as negative Z)
  feeds: FeedOverrides;           // feed, plunge, depthPerPass, rpm, stepover (from material preset unless overridden)
  direction: 'climb' | 'conventional';   // default: climb
  entry: 'plunge' | 'ramp' | 'helix';    // default: ramp (profile), helix (pocket)
  finishingPass: { enabled: boolean; allowance: number; };  // default off; allowance 0.2 mm
  // op-specific:
  profileSide?: 'outside' | 'inside' | 'on';
  tabs?: TabSettings;
}
```

### 9.1 Machine configuration (persisted in `localStorage`)
| Setting | Default | Notes |
|---|---|---|
| Work area X / Y / Z | 300 / 180 / 45 mm | Job-out-of-bounds warning. |
| Max feed XY | 1000 mm/min | Clamp. |
| Max feed Z | 500 mm/min | Clamp for plunge/ramp. |
| Max spindle RPM | 10000 | Physical motor top speed. |
| Max S value (`$30`) | 1000 | `S = round(rpm / maxRpm × $30)`. Many 3018 boards ship with `$30=1000`. |
| Safe Z (retract) | 5 mm | Travel height above stock top. |
| Spindle spin-up dwell | 3 s | `G4 P3` after `M3`. |
| Custom header G-code | *(empty)* | Inserted after the standard preamble. |
| Custom footer G-code | *(empty)* | Inserted before `M2`. |
| End position | Safe Z, then X0 Y0 | Option: "stay put" or "park at X/Y". |

Persisted in `localStorage` (not cookies — cookies are size-limited to ~4 KB and are sent with every request; localStorage is the right tool for "remember my settings"). Settings include a schema `version` for safe migration. "Reset to defaults" button.

### 9.2 Profile (outline)
- **On line**: tool center follows the path. Works on open or closed paths.
- **Outside / Inside**: offset closed path by ±(bitRadius + allowance) with Clipper2 (round joins for outside, miter/round for inside). Inside profiles that collapse (feature smaller than bit) → warning + skipped.
- Multi-pass: `ceil(depth / depthPerPass)` equal passes; final pass at exact depth.
- Direction: for a CW-spindle, **climb** = outside paths CW / inside paths CCW (machine coords); conventional reverses.
- **Finishing pass**: roughing at `allowance` offset for all depths, then one full-depth pass on the final path with a lighter step (single pass if depth ≤ 2× depthPerPass, otherwise full depth in two steps).
- **Entry**: *ramp* = descend along the path over a distance where the ramp angle ≤ 3° (or ≥ 2× bit diameter); closed loops ramp along the start of the loop and the ramp segment is re-cut at depth. *Plunge* = straight down at plunge feed.

- **V-bit on-line ("outline engrave")**: the V-bit follows the path at a fixed depth. Groove width at the surface = `tip + 2 × depth × tan(angle / 2)`. The properties panel shows this width live, so the user picks the depth by the line width they want. Passes come from depth/pass as usual. This is the **MVP operation** (§14).

### 9.3 Tabs (profile with depth ≥ material thickness, or user enables)
```ts
interface TabSettings { enabled: boolean; count: number; width: number; height: number; manual: Vec2[] | null; }
```
- Defaults: enabled when depth ≥ stock thickness; count by perimeter (≈ 1 per 100 mm, min 3, max 8); width = 4 mm + bit Ø; height = 1.5 mm.
- Auto-placement: evenly spaced along perimeter, nudged away from tight corners (prefer straight segments).
- **Manual editing**: in preview mode, clicking on a toolpath adds a tab there; clicking an existing tab removes it. Switching to manual freezes the auto positions as a starting point.
- Implementation: only passes below `-(thickness - tabHeight)` lift over tabs; lift is a vertical move (simple, robust) — trapezoidal ramps over tabs are a later improvement.

### 9.4 Pocket
- Closed paths only (open paths → error on that object). Islands/holes respected via fill rule.
- Strategy: **contour-parallel offset** — repeatedly offset inward by `stepover × Ø` with Clipper2 until empty; link rings inside→out (or out→in), stay down between rings when the link stays inside the pocket, otherwise retract.
- Finishing pass: wall pass at final boundary after roughing with allowance; floor gets the final ring.
- Entry: **helix** (radius ≤ 0.4×Ø… up to 0.9×Ø based on available space, ≤ 3° pitch); falls back to ramp, then plunge if no room.
- Material left behind in corners narrower than the bit → warning highlighting the area (compare pocket region vs union of swept tool area).

### 9.5 V-carve
- V-bits only, closed paths only.
- Algorithm: **medial-axis carving**. Sample boundaries densely (~0.05 mm), compute Voronoi (d3-delaunay), keep edges inside the shape → medial axis. Depth at each point = `distance_to_boundary / tan(angle / 2)`. Prune tiny branches (noise from sampling). Emit as 3D polylines (X/Y/Z varying).
- If total depth at any point > depthPerPass, the carve is done in multiple step-down passes, each clamped at `max(-passDepth, -z)`.
- **No flat-bottom / clearing tool in v1.** If the max computed depth exceeds the stock thickness, or a user-set "max depth warn" (default 50% of thickness), show a warning with the actual depth. Thin strokes at a given bit size are fine; very wide areas will be deep.
- Preview: render with line width representing cut width at the surface.

### 9.6 Validation & warnings
Blocking (Export disabled):
- Operation needs closed paths but object has open paths.
- Bit type incompatible with operation.
- Depth ≤ 0, or no objects have operations.

Warnings (export allowed):
- Toolpaths extend beyond the stock, or beyond the machine work area relative to origin.
- Cut depth > stock thickness (cutting into spoilboard) — expected for through cuts; show "through cut: Xmm into spoilboard".
- Features too small for the bit (skipped inside profiles / uncut pocket regions).
- V-carve deeper than threshold.
- Feeds clamped to machine limits.
- Depth/pass > 50% of bit Ø.

### 9.7 Ordering
Within a bit's file:
1. Operation order: V-carve → Pocket → Profile inside → Profile on-line → Profile outside (inside features before parts get cut free).
2. Within a group: nearest-neighbor ordering from the previous end point to cut rapid travel; for closed loops, choose the start point nearest the previous end (subject to tab/ramp constraints).
3. Depth order: all passes of one contour before moving on (keeps parts rigid; standard hobby approach). (Option "level-first" can be added later.)

---

## 10. Toolpath Preview (2D, v1)

- Toggle on canvas: shows computed toolpaths over the faded design.
- Colors by operation; cuts drawn as solid lines, rapids as thin dashed lines; tabs drawn as markers; plunges/helices as dots.
- Optional **"show cut width"**: stroke width = bit Ø (V-carve: width at surface) at low opacity, which makes uncut areas obvious.
- Filter by bit (matches one exported file).
- **Playback scrubber**: slider over the move list to animate the tool position, with estimated time remaining.
- Stats panel per bit: estimated run time (accounting for feed/rapid rates; GRBL acceleration not modeled, ~10–20% optimistic, labeled as such), cut length, max depth, bounding box.

---

## 11. Mobile / Small Screen Gate

- If viewport width < 600 px **or** (`pointer: coarse` and width < 768 px), render only a full-screen message instead of the app:

  > **Stop being weird.**
  > Cammie needs a real computer or a tablet. Open it on something with a bigger screen.

- Tablets (≥ 768 px) get the full app; touch: one-finger select/drag, two-finger pan/pinch-zoom.

---

## 12. G-code Output (GRBL 1.1 post-processor)

### 12.1 Files
- One file per bit, numbered in the cutting order:
  `<jobname>_<NN>_<bit-slug>.nc` → e.g. `sign_01_vbit-60.nc`, `sign_02_flat-3.175.nc`.
- With a single bit, one file. With several, phase 1 downloads them one after another (the browser may ask once to allow multiple downloads); phase 2 adds a `.zip` option (JSZip).
- Job name defaults to the first imported filename; editable next to Export.

### 12.2 Structure
```gcode
(Cammie v0.1.0 — sign_02_flat-3.175.nc)
(Bit: Flat 3.175mm 2FL | Material: Plywood | Stock: 200x150x6mm)
(Origin: bottom-left, Z0 = top of material)
(File 2 of 2 — change bit and re-zero Z before running)
(Est. time: 14m 30s)
(Start: bit at X0 Y0, touching top of material, spindle off)
G21 G90 G94 G17
(custom header)
G0 Z5.000
M3 S1000
G4 P3
(--- Profile outside: "Rectangle 1" ---)
G0 X10.000 Y10.000
G1 Z0.500 F200
(ramp in)
G1 X40.000 Y10.000 Z-0.800 F200
G1 X190.000 Y10.000 F550
...
G0 Z5.000
(custom footer)
M5
G0 Z5.000
G0 X0 Y0
M2
```

### 12.3 Rules (GRBL 1.1 compatibility)
- **The file only moves the mill.** Before running it, the user has zeroed the bit by hand and parked it at the work origin (X0 Y0, tip touching the top of the material). The file assumes the active work coordinate system is already correct and never changes it.
  - The first motion is always `G0 Z<safeZ>` straight up, before any XY move.
  - Spindle on/off (`M3 S…` / `M5`) is the only non-motion machine control emitted.
  - **Never** emit homing (`$H`), `G28`/`G30`, `G92`, `G10`, work-offset selection (`G54`–`G59`), or probing (`G38.x`). The user can still put anything in the custom header/footer at their own risk.
- Comments: **parentheses only**, no nested parens, ASCII only (sanitize object names).
- Only emit words GRBL supports: `G0 G1 G2 G3 G4 G17 G21 G90 G94 M3 M5 M2 S F X Y Z P`.
  - **Never** emit `T`/`M6` (GRBL errors on `M6`), `G41/G42` (no cutter comp — offsets are pre-computed), or `G81–G89` canned cycles.
- Coordinates rounded to 3 decimals; feeds/speeds to integers. Trailing zeros may be trimmed (setting off by default for readability).
- Modal output: emit `F` only when it changes; omit unchanged axes.
- `G1 Z` approach: rapid to `Z = +0.5` above the surface, then feed down (never rapid into material).
- Linear segments only in v1 (`G1`). **Arc fitting** (merge colinear points, fit `G2/G3` within 0.005 mm) is a later optimization — reduces file size and gives smoother motion on GRBL's planner.
- Line count sanity: co-linear point merge within 0.002 mm before output.
- Line endings `\n`; final newline; no line numbers.
- Y axis: canvas Y-down converted to machine Y-up relative to the chosen origin anchor.

### 12.4 Post-processor contract
```ts
interface PostProcessor {
  readonly id: string;              // 'grbl-1.1'
  render(program: ToolpathProgram, ctx: PostContext): string;
}
```
CAM produces a machine-agnostic `ToolpathProgram` (list of moves: rapid/feed with XYZ + feed + comment markers); the GRBL post turns it into text. Other dialects can be added later without touching CAM code.

---

## 13. Architecture

### 13.1 Stack
| Concern | Choice |
|---|---|
| Build | Vite + TypeScript (strict) |
| UI | React 18 |
| State | Zustand (small slices: job, selection, ui, settings) |
| Canvas | Konva via `react-konva` (design + 2D preview) |
| Path offset / booleans | Clipper2 JS port (`clipper2-js`) — integer-scaled (×1000 = µm) |
| Fonts → paths | `opentype.js` |
| Bitmap trace | Own marching-squares tracer in `src/core/trace` (in a worker) |
| Voronoi (V-carve) | `d3-delaunay` |
| Workers | Vite native workers + `comlink` |
| Zip export | `jszip` |
| Tests | Vitest (unit, golden G-code snapshots), Playwright (a few smoke e2e) |
| Lint/format | ESLint + Prettier |
| Hosting | Firebase Hosting (static `dist/`, SPA rewrite, long cache on hashed assets) |

### 13.2 Module layout
Rule of thumb: **files stay under ~500 lines**; split by responsibility before that. Core CAM code is framework-free pure TypeScript, so it can be unit-tested and reasoned about without React.

```
src/
  app/                 # React shell: layout, routing-free top level, mobile gate
  ui/
    canvas/            # Konva stage, object renderers, selection/transform handles
    panels/            # properties panel, job panel, machine settings dialog, bit library
    preview/           # toolpath layer, scrubber, stats
    import/            # SVG import, PNG trace dialog
  state/               # zustand slices + undo/redo command stack
  core/
    geometry/          # Vec2, Path, PathSet, flatten (bezier/arc), transforms, bbox, clean-up
    clipper/           # thin adapter over Clipper2 (offset, union, difference) — the only file that knows Clipper
    import/            # svgParser.ts, svgUnits.ts, traceImage.ts (pure)
    text/              # fontLoader.ts, textToPaths.ts
    cam/
      operations/      # Operation interface + profile.ts, pocket.ts, vcarve.ts
      strategies/      # entry (ramp/helix/plunge), tabs, ordering, multipass
      program.ts       # ToolpathProgram types + builder
      estimate.ts      # time/length estimation
      validate.ts      # warnings & errors
    post/
      PostProcessor.ts
      grbl/            # grblPost.ts, formatting.ts, header.ts
  data/                # materials.ts, bits.ts, fonts.ts (bundled presets)
  persistence/         # localStorage repository w/ schema versioning
  workers/             # cam.worker.ts, trace.worker.ts (thin; delegate to core/)
public/fonts/          # bundled OFL .ttf files + licenses
```

### 13.3 Design principles (SOLID, applied)
- **S**: one job per module — parsing, offsetting, op generation, posting, and rendering never mix.
- **O**: new operations implement `Operation`; new machines implement `PostProcessor`. Registration via a small registry, no `switch` sprawl.
- **L**: all `Operation`s accept `(geometry, settings, bit, material, machine)` and return a `ToolpathProgram` fragment + diagnostics.
- **I**: UI depends on narrow selectors/hooks, not whole stores; workers expose a minimal API.
- **D**: CAM depends on interfaces (`OffsetEngine`, `PostProcessor`), not on Clipper/Konva directly — the Clipper adapter is swappable and mockable in tests.

```ts
interface Operation<S extends OperationSettings = OperationSettings> {
  readonly type: S['type'];
  supports(bit: Bit): boolean;
  validate(geometry: PathSet, settings: S, ctx: CamContext): Diagnostic[];
  generate(geometry: PathSet, settings: S, ctx: CamContext): ToolpathFragment;
}
```

### 13.4 Persistence (`localStorage` only)
| Key | Contents |
|---|---|
| `cammie.machine.v1` | Machine config (§9.1) |
| `cammie.bits.v1` | Custom bits |
| `cammie.feedOverrides.v1` | Per material+bit feed overrides |
| `cammie.prefs.v1` | Last material, stock size, origin, UI prefs |

All reads wrapped in try/catch with fallback to defaults (private mode / blocked storage must not break the app). The design itself is **not** persisted — a reload starts fresh (a "you have unsaved work" `beforeunload` prompt when objects exist).

### 13.5 Hosting
- `firebase.json`: public `dist`, SPA rewrite to `/index.html`, `Cache-Control: immutable` for `/assets/**`, short cache for `index.html`.
- No Firebase SDK in the app (no backend, no analytics in v1).
- Deploy: `npm run build && firebase deploy --only hosting` (optional GitHub Action later).

---

## 14. Phased Delivery

Each phase ends in something deployable and usable.

| Phase | Scope | Done when |
|---|---|---|
| **0 — Skeleton** | Vite/React/TS scaffold, lint/test setup, Firebase config, mobile gate, machine settings dialog + persistence. | Deployed empty app on Firebase; settings survive reload. |
| **1 — MVP: PNG trace → V-bit outline engrave** | PNG trace dialog (threshold, invert, despeckle, smoothing) in a worker; canvas (stock, grid, move/scale/rotate, origin selection); V-bit library + material presets; V-bit on-line profile at fixed depth with multi-pass and live groove-width readout (§9.2); GRBL post; `.nc` export; 2D preview + estimate; validation. | A traced logo PNG engraves cleanly on the 3018 via gSender (air-cut first, then wood). |
| **2 — SVG + flat-bit profiles** | SVG import + units; flat end mills; profile inside/outside with offsets; multi-bit jobs exported as one file per bit (zip). | A real SVG part is cut out to size (±0.1 mm). |
| **3 — Real-world cutting** | Pocket (with islands), tabs (auto + click-edit), ramp/helix entry, finishing pass, climb/conventional, cut ordering, custom bits, feed overrides memory. | Cut-out parts with pockets come out clean and stay held by tabs. |
| **4 — Text & shapes** | Bundled fonts, text tool, rect/ellipse, group/align, undo/redo polish. | Make a name sign without leaving the app. |
| **5 — V-carve** | Medial-axis V-carve, multi-pass step-down, depth warnings, preview widths. | Crisp V-carved lettering in hardwood. |
| **6 — Later** | Spoilboard surfacing job, 3D carve simulation (heightmap stock + Three.js), arc fitting (G2/G3), trapezoidal tab ramps, flat-bottom V-carve with clearing bit, level-first ordering, raster pocket strategy, bit library import/export. | — |

---

## 15. Testing Strategy

- **Unit (Vitest)**: geometry (flattening, transforms, units), Clipper adapter, each operation, tab placement, entry strategies, S-value mapping, origin/Y-flip transforms.
- **Golden files**: fixed SVG + settings → expected `.nc` snapshot. Any G-code change shows up in review.
- **G-code linter test**: every generated program passes a checker that rejects unsupported words, unbalanced/nested comments, rapids below Z0 (except retracts), feeds > machine max, coordinates outside configured work area.
- **E2E smoke (Playwright)**: import SVG → set profile → export → file downloads and passes the linter.
- **Manual hardware checklist** (per phase): air cut at Z+10 in gSender, then scrap material; verify dimensions with calipers (outside/inside offsets within ±0.1 mm).

---

## 16. Assumptions & Open Questions

Assumptions made (change any of these freely):
- Spindle is clockwise (`M3`); no coolant/vacuum M-codes.
- The user zeros by hand and starts every file with the bit at the work origin; Cammie never emits homing, probing or offset changes.
- Default origin anchor on a new job = bottom-left (selectable per job).
- Climb milling is the default.
- Material preset numbers in §8 are reasonable starting points and will be tuned after test cuts.

Open questions:
1. **Branding.** Logo to come: Cammie the weasel, wearing a bow tie. Use it for the favicon, the app header and the mobile-gate screen.
