import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("viewer");
const info = document.getElementById("model-info");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce7eb);

const camera = new THREE.PerspectiveCamera(
  60, 1, 0.01, 2000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

container.appendChild(renderer.domElement);

// ILUMINACION

scene.add(
  new THREE.HemisphereLight(
    0xffffff,
    0x999999,
    2.4
  )
);

const light = new THREE.DirectionalLight(
  0xffffff, 2.5
);

light.position.set(8, 14, 10);
scene.add(light);

// CONTROLES

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;

// CARGAR SALON DESDE SKETCHUP

const loader = new GLTFLoader();

loader.load(
  "./assets/models/salon-clases.glb",

  (gltf) => {
    const model = gltf.scene;

    scene.add(model);
    model.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const longest = Math.max(
      size.x, size.y, size.z, 1
    );

    camera.position.set(
      center.x + longest * 1.15,
      center.y + longest * 0.8,
      center.z + longest * 1.15
    );

    camera.near = Math.max(longest / 10000, 0.01);
    camera.far = Math.max(longest * 30, 100);
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.maxDistance = longest * 8;
    controls.update();

    const grid = new THREE.GridHelper(
      Math.max(size.x, size.z, 10) * 1.5,
      20,
      0x5c7888,
      0x9fb1bb
    );

    grid.position.set(
      center.x,
      box.min.y - 0.02,
      center.z
    );

    scene.add(grid);

    let meshes = 0;

    model.traverse(object => {
      if (object.isMesh) {
        meshes++;
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const dimensions = {
      anchoX: size.x.toFixed(3),
      alturaY: size.y.toFixed(3),
      profundidadZ: size.z.toFixed(3),
      centroX: center.x.toFixed(3),
      centroY: center.y.toFixed(3),
      centroZ: center.z.toFixed(3),
      minimoX: box.min.x.toFixed(3),
      minimoY: box.min.y.toFixed(3),
      minimoZ: box.min.z.toFixed(3),
      maximoX: box.max.x.toFixed(3),
      maximoY: box.max.y.toFixed(3),
      maximoZ: box.max.z.toFixed(3)
    };

    console.log("SALON SKETCHUP CARGADO");
    console.table(dimensions);
    console.log("Mallas:", meshes);

    info.textContent =
      "Salón cargado | " +
      `X: ${dimensions.anchoX} m | ` +
      `Y: ${dimensions.alturaY} m | ` +
      `Z: ${dimensions.profundidadZ} m | ` +
      `${meshes} mallas`;

    window.CLASSROOM_DEBUG = {
      model,
      scene,
      box,
      size,
      center,
      camera,
      dimensions
    };
  },

  undefined,

  error => {
    console.error("Error cargando salón:", error);
    info.textContent = "Error al cargar salon-clases.glb";
  }
);

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false);
}

new ResizeObserver(resize).observe(container);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
