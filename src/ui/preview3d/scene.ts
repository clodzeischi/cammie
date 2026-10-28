import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Stock } from '../../core/job/job';
import type { MaterialLook } from '../../core/materials/materialLooks';
import type { MeshData } from '../../core/sim/stockMesh';
import type { SimResponse } from '../../workers/sim.worker';
import { createStockMaterial } from './stockMaterial';

export type CameraView = 'angled' | 'top' | 'underneath';

export interface SceneColors {
  background: string;
  warning: string;
}

export interface StockScene {
  show(result: SimResponse, stock: Stock, look: MaterialLook): void;
  setView(view: CameraView): void;
  setColors(colors: SceneColors): void;
  dispose(): void;
}

/** Loose pieces float this far above the board (mm), so they're impossible to miss. */
const liftFor = (stock: Stock) => Math.max(4, stock.thickness * 0.8);
/** The spoilboard reaches this far past the stock (mm) and is this thick. */
const SPOILBOARD_MARGIN = 15;
const SPOILBOARD_THICKNESS = 8;

/** Spoilboard colour where cuts went into it. */
const SPOIL_MARK = [214, 64, 52, 230];

/**
 * Red marks on the spoilboard wherever a cut went past the stock, seen
 * through the cut. Texture rows run bottom-up, the grid's rows top-down.
 */
function spoilTexture(result: SimResponse): THREE.DataTexture {
  const { cols, rows, spoilMask } = result;
  const pixels = new Uint8Array(cols * rows * 4);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!spoilMask[row * cols + col]) continue;
      pixels.set(SPOIL_MARK, ((rows - 1 - row) * cols + col) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, cols, rows);
  texture.needsUpdate = true;
  return texture;
}

function geometry(mesh: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return g;
}

/**
 * The 3D view: the carved stock on a spoilboard, loose pieces lifted out,
 * orbit / pan / zoom. Draws only when something changes. Z is up; X and Y
 * match the machine (X right, Y away from the viewer).
 */
export function createStockScene(container: HTMLElement, colors: SceneColors): StockScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.screenSpacePanning = true;

  // Soft surroundings to reflect: without them metals render nearly black.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b6256', 1.1));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(-0.6, -0.8, 1.2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.position.set(0.8, 0.6, -0.4);
  scene.add(fill);

  scene.background = new THREE.Color(colors.background);
  let warning = new THREE.Color(colors.warning);
  /** The stock last shown; the camera is re-aimed when it changes size. */
  let size: { width: number; height: number; depth: number } | null = null;

  // Everything but the carved pieces lives for the whole scene: rebuilding
  // materials makes three.js recompile shaders, which costs far more than
  // the new geometry. Unit-sized shapes are scaled to the stock instead.
  const pieces = new THREE.Group();
  scene.add(pieces);
  const spoilboard = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.95 }),
  );
  spoilboard.visible = false;
  scene.add(spoilboard);
  const marksMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), marksMaterial);
  scene.add(marks);
  let stockMaterials: { key: string; board: THREE.Material; loose: THREE.Material } | null = null;

  const materialsFor = (look: MaterialLook, thickness: number) => {
    const key = `${JSON.stringify(look)}|${thickness}`;
    if (stockMaterials?.key !== key) {
      stockMaterials?.board.dispose();
      stockMaterials?.loose.dispose();
      stockMaterials = {
        key,
        board: createStockMaterial(look, thickness),
        // Still the board's material, tinted with the warning colour.
        loose: createStockMaterial(look, thickness, warning),
      };
    }
    return stockMaterials;
  };

  const render = () => {
    // Looking from below, the spoilboard would hide the stock's underside.
    if (size) spoilboard.visible = camera.position.z > -size.depth;
    renderer.render(scene, camera);
  };
  controls.addEventListener('change', render);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize(); // so the first camera fit knows the pane's shape

  const clearPieces = () => {
    pieces.children.forEach((o) => (o as THREE.Mesh).geometry.dispose());
    pieces.clear();
  };

  const setView = (view: CameraView) => {
    if (!size) return;
    const centre = new THREE.Vector3(size.width / 2, size.height / 2, -size.depth / 2);
    // Far enough that the whole stock (and its spoilboard) fits the pane both ways.
    const radius =
      Math.hypot(size.width + 2 * SPOILBOARD_MARGIN, size.height + 2 * SPOILBOARD_MARGIN) / 2;
    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const reach = (radius / Math.sin(Math.min(vertical, horizontal))) * 0.9;
    const direction =
      view === 'top'
        ? new THREE.Vector3(0, -0.001, 1)
        : view === 'underneath'
          ? new THREE.Vector3(0.35, -0.75, -0.75)
          : new THREE.Vector3(0.35, -0.85, 0.75);
    camera.position.copy(centre).addScaledVector(direction.normalize(), reach);
    controls.target.copy(centre);
    controls.update();
    render();
  };

  return {
    show(result, stock, look) {
      clearPieces();
      const materials = materialsFor(look, stock.thickness);
      pieces.add(new THREE.Mesh(geometry(result.meshes.board), materials.board));
      for (const { mesh } of result.meshes.loose) {
        const piece = new THREE.Mesh(geometry(mesh), materials.loose);
        piece.position.z = liftFor(stock);
        pieces.add(piece);
      }

      marksMaterial.map?.dispose();
      marksMaterial.map = spoilTexture(result);
      marksMaterial.needsUpdate = true;
      const { cols, rows, cell } = result;
      marks.scale.set(cols * cell, rows * cell, 1);
      marks.position.set((cols * cell) / 2, (rows * cell) / 2, -stock.thickness - 0.03);

      spoilboard.scale.set(
        stock.width + 2 * SPOILBOARD_MARGIN,
        stock.height + 2 * SPOILBOARD_MARGIN,
        SPOILBOARD_THICKNESS,
      );
      spoilboard.position.set(
        stock.width / 2,
        stock.height / 2,
        -stock.thickness - SPOILBOARD_THICKNESS / 2 - 0.05,
      );

      const changedSize =
        !size ||
        size.width !== stock.width ||
        size.height !== stock.height ||
        size.depth !== stock.thickness;
      size = { width: stock.width, height: stock.height, depth: stock.thickness };
      if (changedSize) setView('angled');
      else render();
    },
    setView,
    setColors(next) {
      scene.background = new THREE.Color(next.background);
      warning = new THREE.Color(next.warning);
      (stockMaterials?.loose.userData.highlight as THREE.Color | undefined)?.copy(warning);
      render();
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      clearPieces();
      stockMaterials?.board.dispose();
      stockMaterials?.loose.dispose();
      marksMaterial.map?.dispose();
      marksMaterial.dispose();
      marks.geometry.dispose();
      spoilboard.geometry.dispose();
      (spoilboard.material as THREE.Material).dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
