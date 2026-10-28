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
| Cloud storage, accounts, sync | Projects are local `.cammie` files plus a browser backup (§13.4). No backend, and Cammie stays free. |
| DXF import | SVG and PNG only. |
| Laser support (M4, raster engraving) | Spindle-only machine. |
| 3D relief / heightmap carving, undercut bits (T-slot, dovetail) | 2D / 2.5D only. Round-nose bits engrave grooves (§7). |
| Mobile phone layout | Phones get a blocking message (see §11). Tablets are supported. |
| Inch units | mm everywhere, output is always `G21`. |
| Animated 3D carving | The 3D view (§10.1) shows the finished piece only; the 2D preview has playback. |
| Homing, probing, zeroing | The user zeros the bit by hand at the work origin. The `.nc` file only moves the mill (§12.3). |
| Spoilboard surfacing | Later phase (§14). |

---

## 3. Core Workflow & UI Layout

One screen with two modes, switched by an **Easy ↔ Pro** toggle in the header. Pro is the full
model; Easy is the same app with limits switched on, so both share one job and one code path.
New visitors start in Easy; the last mode is remembered (`cammie.mode.v1`, with Easy's bit).

```
Pro
┌──────────────────────────────────────────────────────────────────────────┐
│ Cammie [job name]        [New][Open][Save]  EASY ◯━ PRO   [Export 2 files]│
├──────────────────────────────────────────────────────────────────────────┤
│ Shapes | Toolpaths | Setup                    (ribbon: labelled buttons)  │
├──────────────┬────────────────────────────────────┬──────────────────────┤
│ Toolpaths    │                                    │ Selected toolpath,   │
│ ① End mill   │      Design canvas                 │ object, or job       │
│   Pocket     │                                    │ settings             │
│   Cut out    │                                    │                      │
│ ↻ Change bit │                                    │                      │
│ ② V-bit 60°  │  [Design] [Toolpath preview]       │ Checks               │
│   Engrave    │                                    │                      │
└──────────────┴────────────────────────────────────┴──────────────────────┘
```

- **Ribbon (Pro)**: *Shapes* (Import, Text, Rectangle, Circle · Duplicate, Group, Ungroup, Delete ·
  Undo, Redo), *Toolpaths* (Engrave, Profile outside, Profile inside, Pocket, Chamfer, Drill · Simulate), *Setup*
  (Stock & material, Bits, Machine). Every button has a text label.
- **Toolpath list (Pro)**: the whole plan in cut order. One group per bit (= one `.nc` file), with
  a "Change bit, then re-zero Z" step between groups. Rows and whole files move up/down; rows
  show a dot when they have a warning or error. Selecting a row opens its settings, headed by one
  plain sentence saying what it will do.
- **Easy**: the same ribbon buttons as Pro (icon over label, group labels), without tabs: Import, Text, Rectangle, Circle · Undo, Redo. Material and the job's
  one bit sit in the header. Selecting shapes asks "How should this be cut?" with four plain
  choices (Engrave line, Cut out, Cut hole, Clear area); choices the bit can't do stay visible,
  disabled with the reason. Only depth (and tabs) are shown; feeds and entry come from presets.
  Chamfers and drilling are Pro only.
- **Mode rules**: Easy → Pro never changes anything. Pro → Easy is blocked while the job uses Pro
  features (more than one bit, more than one cut on a shape, chamfers or drilling, bottom cuts):
  the toggle and the "Easy" label are disabled, and hovering says "Cannot switch, Pro features in
  use". A Pro job opened or restored while in Easy shows read-only with a "Switch to Pro" button.
  Nothing is deleted.
- **Project** (header, both modes): *New* (asks first if there's a design), *Open…* (⌘/Ctrl-O) and *Save* (⌘/Ctrl-S, downloads `<job>.cammie`). See §13.4.
- **Canvas**: stock rectangle drawn to scale, mm grid, rulers, selectable origin marker, dashed outline of machine work area. Pan (space/middle-drag), zoom (wheel/pinch).
- **Grid & snapping** (controls beside the zoom buttons; remembered in localStorage as `cammie.grid.v1`):
  - Grid size: 0.5, 1, 2, 5, 10 (default), 20, 25 or 50 mm. Lines run through the work origin, so snapped objects get round X/Y values. Darker major lines every round 5/10/25/50/100… mm. Lines closer than 6 px on screen are left out (only major lines when zoomed far out).
  - Snap (on by default): dragging moves the object so whichever of its box edges is nearest a grid line lands on it (per axis); resize handles land on grid points; rotation isn't snapped. Hold Alt/Option while dragging to place freely. Typed positions and arrow-key nudges are never snapped.
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
  toolpaths: Toolpath[];         // cut order
  flip: 'left-right' | 'top-bottom';  // how the stock turns over for bottom cuts (§9.10)
}

type OriginAnchor =
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'center-left' | 'center'       | 'center-right'
  | 'top-left'    | 'top-center'   | 'top-right';
// Z0 is always the TOP of the material. All cuts are negative Z.

interface DesignObject {
  id: string;
  name: string;
  kind: 'svg' | 'traced-image' | 'text' | 'rect' | 'ellipse';
  shape?: TextShape | RectShape | EllipseShape;  // params of text/shapes drawn in the app
  groupId?: string;              // objects sharing one are selected/arranged together
  role?: 'registration';         // dowel-pin holes, checked against the flip line (§9.10)
  paths: Path[];                 // flattened outlines in object-local mm, box starting at (0,0)
  width: number; height: number; // natural size of `paths`
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
}

// One cut on one object. Objects with no toolpaths aren't cut; an object may have several.
interface Toolpath { id: string; objectId: string; operation: Operation; face?: 'top' | 'bottom'; }
// Job.toolpaths: Toolpath[] — list order is cut order. Toolpaths sharing a face and bit form one
// file; every top file runs before any bottom file, otherwise in the order their bits first appear. New toolpaths are inserted where they
// naturally run (pockets, holes, lines, then cut-outs), so the default order is the safe one.

interface Path { points: Vec2[]; closed: boolean; }
```

- Editing shape params (text, font, corner radius…) rebuilds `paths`.
- **Selection**: a click picks the object whose outline it lands on (within 5 screen px) or inside one of its closed outlines; text is picked anywhere in its box. Empty space inside another object's bounding box reaches whatever is behind. Where shapes overlap, the smaller one wins (outlines have no fill, so stacking isn't visible; click areas are stacked by size), so a shape inside a bigger one is always reachable. Click selects; Shift-click adds/removes; ⌘/Ctrl-A selects all. Pressing on an already-selected object keeps the selection so several objects drag together; a click without dragging picks just that object. Several selected objects share one transformer (move/resize/rotate together).
- **Groups**: ⌘/Ctrl-G groups the selection, ⇧⌘/Ctrl-G ungroups. A group is a selection unit (clicking any member selects all) and moves/aligns as one. Cuts are per object: in Easy a cut choice applies to every selected object; in Pro adding a toolpath gives each selected object its own.
- **Arrange**: move, scale (lock aspect by default), rotate, duplicate (⌘/Ctrl-D, copies offset 5 mm, copied groups become new groups), delete, align left/centre/right/top/middle/bottom (several units align to their combined box; a single unit aligns to the stock), centre on stock, nudge with arrow keys (1 mm, Shift = 10 mm).
- **Undo/redo**: ⌘/Ctrl-Z, ⇧⌘/Ctrl-Z or Ctrl-Y, toolbar buttons; 100 steps of the design (objects + selection; stock/origin/material are settings, not undone). A burst of edits to the same fields of one object within 1 s (typing a number or text, repeated nudges) is one step. Shortcuts are ignored while typing in a field, so fields keep their own undo.

---

## 5. Import

### 5.1 SVG
- Parse with the browser's `DOMParser`; walk `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, honoring nested `transform`s and `viewBox`.
- `<text>` in SVG is **not** supported → warning "convert text to paths in your editor" (or use our text tool).
- Ignore fills/strokes styling; geometry only. Strokes are treated as centerline paths.
- **Scale**: honor `width`/`height` units (`mm`, `cm`, `in`, `pt`, `pc`, `px`) + `viewBox`. Unitless/px → assume 96 DPI. After import, user can type an exact width/height.
- Curves (cubic/quadratic Bézier, arcs) are flattened to polylines with a chord tolerance of **0.01 mm** (configurable in Advanced).
- Clean-up on import: join path segments whose endpoints are within 0.01 mm, mark as closed if start≈end, drop zero-length segments, drop duplicate points.
- Fill rule: an object's closed paths are read with the **even-odd** rule (nested outlines alternate solid/hole), which matches traced images and how most design apps export holes. Per-element `fill-rule` isn't honoured; overlapping separate shapes in one SVG therefore cancel where they overlap.

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
- Font files: the regular weight, Latin subset (Western European accents included), as `.woff` from the `@fontsource/*` npm packages (OFL; licence in each package). Each is ~10–70 KB and downloads only when first used; `opentype.js` is likewise a lazily loaded chunk.
- Properties: text (multi-line), font (grouped by style), letter height (cap height in mm), letter spacing (mm), line spacing (× the font's normal), alignment. Sizes are shown as cut, i.e. including any resizing on the canvas; letter height is effectively a proportional resize.
- Glyphs → paths via `opentype.js`, one glyph per character with kerning (no ligatures/contextual alternates: opentype.js's shaping throws on some fonts' substitution tables). Curves flattened to 0.005 mm. Overlapping contours (script fonts, tight spacing) are unioned with Clipper2 (non-zero rule) so pockets/V-carves don't double-cut.
- Characters the font lacks are left out and listed under the text box; blank text isn't applied.
- When text changes width, its aligned side stays put (centred text grows both ways); the object keeps its rotation and scale. Objects and (until the user names it) the job are named after the first line of text.

### 6.2 Shapes
- Rectangle (w, h, corner radius, default 60 × 40), Circle/Ellipse (w, h, default Ø40). All parametric and editable numerically; width/height live under Placement like any object.
- Resizing a rectangle or ellipse (canvas or fields) stores the new real size and keeps scale at 1, so corners stay round instead of squashing. On their own they get side handles for free stretching; everything else resizes proportionally from the corners. Curves are flattened to 0.01 mm.

---

## 7. Tools (Bits)

### 7.1 Types
```ts
type Bit =
  | { id; name; type: 'flat';  diameter: number; flutes: number; fluteLength?: number }
  | { id; name; type: 'vbit';  angle: number; tipDiameter: number; diameter: number; flutes: number }
  | { id; name; type: 'round'; diameter: number; flutes: number };   // round nose / ball end
```
- **Built-in library** (read-only, typical 3018 bits, 1/8" shank):
  - Flat: 1.0, 1.5, 2.0, 3.175 mm (2-flute); 3.175 mm 1-flute (plastics).
  - V-bit: 20°, 30°, 60°, 90° (tip 0.1–0.2 mm, Ø 3.175 mm).
  - Round-nose: 2, 3.175 mm (2-flute).
- **Round-nose bits** (no undercut bits): the end is a half-sphere of the bit's diameter, so a groove `d` deep is `2·√(d·(2r − d))` wide at the surface, reaching the full diameter at `d = r`. The depth hint shows this width like a V-bit's. Feeds scale like a flat bit of the same diameter.
- **Custom bits**: add/edit/delete, stored in `localStorage`. Exportable/importable as JSON (nice-to-have).

### 7.2 Which bit can do what
One table in `core/job/bitCapabilities.ts` drives CAM validation and which choices the UI offers (a cut the bit can't make stays visible, disabled with the reason).

| Operation | Flat end mill | V-bit | Round-nose |
|---|---|---|---|
| Profile on the line (engrave) | ✅ | ✅ | ✅ (rounded groove) |
| Profile inside/outside | ✅ | ❌ | ❌ |
| Pocket | ✅ | ❌ | ❌ |
| Chamfer | ❌ | ✅ | ❌ |
| Drill | ✅ | ❌ | ✅ |
| V-carve | ❌ | ✅ | ❌ |

---

## 8. Materials & Feeds/Speeds

Presets are **conservative starting points for a stock 3018 (~10k RPM 775 spindle, flexible frame)**. Feeds are edited per **material + bit pair**, not per object: a change applies to every cut using that pair and is remembered in `localStorage` (`cammie.feedOverrides.v1`). "Reset" returns the pair to the preset.

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

CAM is pure, synchronous TypeScript (`generateJob`), recomputed whenever the design, material, machine settings, bits or remembered feeds change. Measured at phase 3: a busy traced design (65 loops) pockets in ~45 ms and profiles with tabs in ~30 ms, so it stays on the main thread. V-carve (phase 5) moves it into a **Web Worker** if it needs to.

Common per-operation settings:
```ts
interface OperationSettings {
  type: 'profile' | 'pocket' | 'chamfer' | 'drill' | 'vcarve';
  bitId: string;
  depth: number;                  // total cut depth, mm (positive number; emitted as negative Z)
  feeds: FeedOverrides;           // feed, plunge, depthPerPass, rpm, stepover (from material preset unless overridden)
  direction: 'climb' | 'conventional';   // default: climb
  entry: 'plunge' | 'ramp' | 'helix';    // default: ramp (profile), helix (pocket)
  finishingPass: { enabled: boolean; allowance: number; };  // default off; allowance 0.2 mm
  // op-specific:
  profileSide?: 'outside' | 'inside' | 'on';   // chamfer: 'outside' | 'inside'
  tabs?: TabSettings;
}
```

### 9.1 Machine configuration (persisted in `localStorage`)
| Setting | Default | Notes |
|---|---|---|
| Work area X / Y / Z | 300 / 180 / 45 mm | Job-out-of-bounds warning. |
| Max feed XY | 1000 mm/min | Clamp. |
| Max feed Z | 500 mm/min | Clamp for plunge/ramp. |
| Manual spindle control | Off | On: the spindle is switched by hand. Files emit no `M3`/`S`/`G4`/`M5` (just a comment to switch it on before running and off after); max RPM, `$30` and spin-up are hidden and not validated, the per-cut Spindle RPM field is hidden, RPM isn't clamped, and estimates leave out spin-up. |
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
- **Outside / Inside**: offset the object's even-odd region by ±bitRadius with Clipper2 (round joins). Outside grows the solid (holes shrink, so a part with holes comes out right); inside shrinks it. Details narrower than the bit vanish and raise a warning. Open paths are skipped with a warning (error if there are no closed shapes). V-bits are limited to on-line.
- Multi-pass: `ceil(depth / depthPerPass)` equal passes; final pass at exact depth.
- Direction: for a CW-spindle, **climb** = outside paths CW / inside paths CCW (machine coords); conventional reverses.
- **Finishing pass**: roughing at `allowance` offset for all depths, then one full-depth pass on the final path with a lighter step (single pass if depth ≤ 2× depthPerPass, otherwise full depth in two steps).
- **Entry**: *ramp* (default for closed loops) = descend along the loop at ≤ 3°, wrapping round as many laps as needed, then do one full lap at depth (which re-cuts the sloped section flat). The next pass picks up where the last ended. *Plunge* = straight down at plunge feed. Open paths always plunge. Finishing passes plunge (the slot is already open).

- **V-bit on-line ("outline engrave")**: the V-bit follows the path at a fixed depth. Groove width at the surface = `tip + 2 × depth × tan(angle / 2)`. The properties panel shows this width live, so the user picks the depth by the line width they want. Passes come from depth/pass as usual. This is the **MVP operation** (§14).

### 9.3 Tabs (profile with depth ≥ material thickness, or user enables)
```ts
interface TabSettings { enabled: boolean; count: number; width: number; height: number; manual: Vec2[] | null; }
```
- Defaults: enabled when depth ≥ stock thickness; count by perimeter (≈ 1 per 100 mm, min 3, max 8); width = 4 mm + bit Ø; height = 1.5 mm.
- Auto-placement: per loop (outer contours **and** the slugs of inside cuts), count = perimeter/100 mm clamped to 3–8 and reduced so tabs keep at least one tab-length apart; positions evenly spaced, each nudged up to ¼ spacing away from corners sharper than 20°.
- **Manual editing**: in preview, clicking within 10 px of a tab removes it; clicking within 10 px of a tabbable loop adds one at the nearest point. The first edit freezes the current automatic tabs as hand-placed ones, stored in the object's own coordinates so they move with it. "Go back to automatic tabs" clears them.
- Implementation: only passes below `-(thickness - tabHeight)` lift over tabs; the lift is a vertical move at the tab edges (trapezoidal ramps over tabs are a later improvement). Tabs are planned on the finished contour and snap onto the roughing loops too. With tabs active, the "through cut, hold the part down" warning goes away.

### 9.4 Pocket
- Closed paths only (open paths → error on that object). Islands/holes respected via fill rule.
- Strategy: **contour-parallel offset** — repeatedly offset inward by `stepover × Ø` with Clipper2 until empty; link rings inside→out (or out→in), stay down between rings when the link stays inside the pocket, otherwise retract.
- Finishing pass: wall pass at final boundary after roughing with allowance; floor gets the final ring.
- Entry: **ramp along the innermost ring** at ≤ 3°, wrapping round it as many laps as needed (a helix on round pockets), so the tool always enters inside the area being cleared. Disconnected rings at a depth get their own ramp entry; neighbouring rings are linked at depth when the link is ≤ 2 × stepover and doesn't cross a wall or island.
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
1. Operation order: Drill → V-carve → Pocket → Profile inside → Profile on-line → Chamfer → Profile outside (inside features before parts get cut free). New toolpaths are inserted in this order; the user can reorder them in Pro.
2. Within a group: nearest-neighbor ordering from the previous end point to cut rapid travel; for closed loops, choose the start point nearest the previous end (subject to tab/ramp constraints).
3. Depth order: all passes of one contour before moving on (keeps parts rigid; standard hobby approach). (Option "level-first" can be added later.)

### 9.8 Chamfer (Pro)
- V-bits only, closed paths only. Bevels the edges of a shape: **outside** = the shape's own edges (a part, holes included), **inside** = the rim of a hole of this shape.
- The user sets the **chamfer width** (how far the bevel reaches in from the edge at the surface); it's stored as the depth `width / tan(angle / 2)`, so changing to a V-bit with another angle keeps the width. Wider than the cone can reach → error with the maximum width.
- Tool centre = the region offset by half the tip's flat (outward for outside, inward for inside), so the flat cuts down to the drawn line and the cone bevels the kept side. Passes by depth/pass, ramp entry, climb/conventional as for profiles; no finishing pass, no tabs.

### 9.9 Drill (Pro)
- End mills and round-nose bits; closed paths only. One hole the size of the bit at the centre of each closed path's bounding box (duplicates within 0.01 mm merge, so a ring is one hole). A shape more than 0.5 mm wider than the bit gets a note to use Profile inside instead.
- **Peck drilling**: feed down by depth/pass at plunge feed, pull up to +0.5 mm after every peck but the last to clear chips, feed back down (never a rapid below Z0, §12.3). Holes run nearest-neighbour.

### 9.10 Two-sided jobs (Pro)
- Each toolpath has a **side**: Top (default) or Bottom. Objects are always drawn as seen from the top; a bottom toolpath is the same outline cut from the back.
- **Flip** (job setting): *left to right* turns the stock about its vertical centre line, *top to bottom* about its horizontal one. Bottom cuts are mirrored across that line before CAM runs (so climb/conventional, tabs and offsets stay correct), and mirrored back for the preview, so the preview and tab editing always show the design as seen from the top. The origin stays at the same corner of the machine bed, which the flipped stock covers exactly.
- **Files**: one per side and bit; all top files first. Bottom files are named `<job>_<NN>_bottom_<bit>.nc`; the first one's header says to turn the stock over onto the pins (and change the bit if it changed) and re-zero Z. The Pro toolpath list shows *Top side* / *Bottom side* headings and a highlighted "Turn the stock over" step; files only move within their side.
- **Registration holes** (Toolpaths → Registration holes, or the job panel with a pin diameter, default 6 mm): two circles on the flip line, 5 mm + a radius in from the ends, each with a Profile inside cut through the stock and 3 mm into the spoilboard (no tabs, no spoilboard warning). Each lands on itself when the stock turns over, so dowel pins put it back in place. Adding them again replaces the old ones.
- **Working on one side**: in a two-sided job, Pro shows a *Both sides · Top · Bottom* switch next to Design / Toolpath preview. On one side, shapes cut only from the other side are hidden on the canvas and left out of clicks, ⌘A and group selection; the other side's files are hidden from the toolpath list (with a "… side hidden · Show both sides" note; file numbers stay as exported) and from the preview. Registration holes, shapes cut from both sides and shapes with no cuts yet always show. New toolpaths are added to the side shown (the top when showing both). Export always includes both sides; switching to Easy shows both.
- Checks: bottom cuts with no registration holes cut from the top → warning; a registration hole moved off the flip line (> 0.05 mm) → warning. A dashed accent line marks the flip line on the canvas in two-sided jobs. Two-sided jobs are Pro only.

---

## 10. Toolpath Preview (2D, v1)

- Toggle on canvas: shows computed toolpaths over the faded design.
- Colors by operation; cuts drawn as solid lines, rapids as thin dashed lines; tabs drawn as markers; plunges/helices as dots.
- Optional **"show cut width"**: stroke width = bit Ø (V-carve: width at surface) at low opacity, which makes uncut areas obvious.
- Filter by bit (matches one exported file).
- **Playback scrubber**: slider over the move list to animate the tool position, with estimated time remaining.
- Stats panel per bit: estimated run time (accounting for feed/rapid rates; GRBL acceleration not modeled, ~10–20% optimistic, labeled as such), cut length, max depth, bounding box.

### 10.1 3D view of the finished piece
A third view, **3D** (also on the Pro ribbon under *Check*), shows what the stock will look like after every exported file has run, both sides, so the user can check what their settings do: pocket vs hole vs cut-out, depth against the stock, V and round-nose groove shapes. No animation.
- **Simulation** (`src/core/sim`, in a worker): the stock is two height maps over a grid seen from the top, the top surface and the bottom surface (machine Z, 0 = top, −thickness = bottom). Every move of every file presses the bit's real shape into the grid: a flat circle (end mill), a cone with its flat tip (V-bit), a ball (round-nose). Bottom files go through the same face frames as the CAM, so they land mirrored exactly as cut, raising the bottom surface. Where the surfaces meet, the stock is cut through. Cell size ≈ √(area / 600k), 0.05–0.5 mm (≈ 0.2 mm on 200 × 150 mm); the view says how accurate it is. About 0.3 s for 1.5 M cells.
- **Loose pieces**: the remaining material is split into connected pieces; any piece that doesn't reach the stock's outer edge (where it's clamped) comes loose: parts cut out without tabs, hole slugs. They're drawn lifted above the board and tinted toward the warning colour, with "N pieces come loose … add tabs".
- **Spoilboard**: a slab under the stock (hidden when looking from below); cells where a cut went past the stock are marked red on it, and the deepest overcut is reported.
- **Looks** (`src/core/materials/materialLooks.ts`): drawn by a shader from the position in the stock, so cut walls and pocket floors show the inside. Wood grain along X; plywood plies (odd count, ≈ 1.5 mm each) with alternating grain and glue lines between them; MDF smooth skins over a fibrous core; brushed aluminium; speckled foam; plain plastics (acrylic slightly see-through). A soft room environment lights metals.
- **View**: three.js (0.186.1, loaded the first time 3D is opened), orbit / pan / zoom, *Angled*, *Top* and *Underneath* cameras, theme background. Meshes are built in the worker; the page only draws them, and only when the camera moves.

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
- With a single bit, one `.nc` file. With several, one `<job>.zip` containing the numbered files (JSZip, loaded only when needed).
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
  - Spindle on/off (`M3 S…` / `M5`) is the only non-motion machine control emitted, and not even that with manual spindle control (§9.1).
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
| Path offset / booleans | Clipper2 TypeScript port (`@countertype/clipper2-ts`, Boost licence), float API at 1 µm precision, behind `src/core/clipper` |
| Fonts → paths | `opentype.js` |
| Bitmap trace | Own marching-squares tracer in `src/core/trace` (in a worker) |
| Voronoi (V-carve) | `d3-delaunay` |
| 3D view | `three` (lazy chunk) |
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
    text/              # fonts.ts (catalogue), textLayout.ts (glyphs → outlines), textObject.ts
    shapes/            # primitives.ts (rect/ellipse outlines), shapeObjects.ts
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
# Fonts: .woff files imported from @fontsource/* packages (ui/text/fontLoader.ts)
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

All reads wrapped in try/catch with fallback to defaults (private mode / blocked storage must not break the app).

**Projects** (`src/persistence/projectFile.ts`):
- A `.cammie` file is JSON: `{ format: 'cammie-project', version: 1, jobName, job, bits }`, where `job` is the whole §4 `Job` (stock, origin, material, objects, toolpaths, flip) and `bits` the custom bits its toolpaths use, so it opens on another computer. Opening adds those bits to the library unless one with the same id exists (the user's own wins).
- Opening validates everything: not JSON / wrong format → "isn't a Cammie project file"; a newer `version` → "saved by a newer version"; malformed geometry or cuts → "damaged (… couldn't be read)", and nothing is loaded. Settings missing from older files get today's defaults; cuts whose object is missing are dropped. Opening clears undo history.
- **Automatic backup**: the design is saved to IndexedDB (database `cammie`, store `backup`, one entry) 0.8 s after each change. IndexedDB rather than localStorage because traced designs can pass localStorage's ~5 MB. On start-up the backup is restored (if it has objects) with the note "Your design from last time is back. Use New to start over." The `beforeunload` prompt only appears when the latest backup failed (private mode, blocked storage).

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
| **5b — Pro & projects** | Easy/Pro modes, ribbon, toolpath list; round-nose bits; chamfer and drill; two-sided jobs with registration holes; `.cammie` Save/Open + browser backup. | A two-sided box lid with chamfered edges comes out lined up, and the project reopens the next day. |
| **5c — 3D view** | Finished-piece 3D view: two-sided height-map simulation, loose pieces, spoilboard marks, procedural material looks (§10.1). | Pockets, holes, cut-outs and depths read at a glance; untabbed parts are obvious. |
| **6 — Later** | Spoilboard surfacing job, arc fitting (G2/G3), trapezoidal tab ramps, flat-bottom V-carve with clearing bit, level-first ordering, raster pocket strategy, bit library import/export. | — |

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
