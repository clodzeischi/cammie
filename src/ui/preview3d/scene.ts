import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Stock } from '../../core/job/job';
import type { MaterialLook } from '../../core/materials/materialLooks';
import type { MeshData } from '../../core/sim/stockMesh';
import type { SimResponse } from '../../workers/sim.worker';

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

  scene.add(new THREE.HemisphereLight('#ffffff', '#6b6256', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(-0.6, -0.8, 1.2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.position.set(0.8, 0.6, -0.4);
  scene.add(fill);

  const model = new THREE.Group();
  scene.add(model);
  scene.background = new THREE.Color(colors.background);
  let warning = new THREE.Color(colors.warning);
  /** The stock last shown; the camera is re-aimed when it changes size. */
  let size: { width: number; height: number; depth: number } | null = null;

  let spoilboard: THREE.Mesh | null = null;
  const render = () => {
    // Looking from below, the spoilboard would hide the stock's underside.
    if (spoilboard && size) spoilboard.visible = camera.position.z > -size.depth;
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

  const clear = () => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    model.clear();
  };

  const setView = (view: CameraView) => {
    if (!size) return;
    const centre = new THREE.Vector3(size.width / 2, size.height / 2, -size.depth / 2);
    const reach = Math.max(size.width, size.height) * 1.6;
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
      clear();
      const material = new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.85 });
      model.add(new THREE.Mesh(geometry(result.meshes.board), material));
      for (const { mesh } of result.meshes.loose) {
        const piece = new THREE.Mesh(
          geometry(mesh),
          new THREE.MeshStandardMaterial({ color: warning, roughness: 0.7 }),
        );
        piece.position.z = liftFor(stock);
        model.add(piece);
      }
      spoilboard = new THREE.Mesh(
        new THREE.BoxGeometry(
          stock.width + 2 * SPOILBOARD_MARGIN,
          stock.height + 2 * SPOILBOARD_MARGIN,
          SPOILBOARD_THICKNESS,
        ),
        new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.95 }),
      );
      spoilboard.position.set(
        stock.width / 2,
        stock.height / 2,
        -stock.thickness - SPOILBOARD_THICKNESS / 2 - 0.05,
      );
      model.add(spoilboard);

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
      render();
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      clear();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
