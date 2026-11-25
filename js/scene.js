
import * as THREE from "three";

export const TABLE_POSITIONS = [
  new THREE.Vector3(-1.70, 0, 1.70),
  new THREE.Vector3(-0.55, 0, 1.70),
  new THREE.Vector3(0.55, 0, 1.70),
  new THREE.Vector3(1.70, 0, 1.70)
];

export const TABLE_SIZE = {
  width: 1.20,
  depth: 0.75,
  height: 0.75,
  thickness: 0.1
};

function createTextLabel(text, width = 1.3, height = 0.3) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#10243c";
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = "#38d9ff";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 120);

  ctx.font = "bold 48px Arial";
  ctx.fillStyle = "#eaf5ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    material
  );

  return mesh;
}

function createTable(index, position) {
  const table = new THREE.Group();

  const topMaterial = new THREE.MeshStandardMaterial({
    color: 0x193a59,
    metalness: 0.35,
    roughness: 0.45
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x627d99,
    metalness: 0.65,
    roughness: 0.3
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x38d9ff,
    emissive: 0x087393,
    emissiveIntensity: 0.4
  });

  const { width, depth, height, thickness } = TABLE_SIZE;

  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(width, thickness, depth),
    topMaterial
  );

  surface.position.y = height;
  surface.castShadow = true;
  surface.receiveShadow = true;
  table.add(surface);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(
      width + 0.04,
      0.025,
      depth + 0.04
    ),
    edgeMaterial
  );

  edge.position.y = height - thickness / 2;
  table.add(edge);

  const legHeight = height - thickness / 2;

  const legGeometry = new THREE.BoxGeometry(
    0.09,
    legHeight,
    0.09
  );

  for (const x of [-width / 2 + 0.15, width / 2 - 0.15]) {
    for (const z of [-depth / 2 + 0.15, depth / 2 - 0.15]) {
      const leg = new THREE.Mesh(legGeometry, legMaterial);

      leg.position.set(x, legHeight / 2, z);
      leg.castShadow = true;
      table.add(leg);
    }
  }

  const label = createTextLabel(`MESA ${index + 1}`);

  label.position.set(0, height + 0.3, 0);
  label.rotation.y = Math.PI;

  table.add(label);

  table.position.set(position.x, 0, position.z);

  table.userData = {
    type: "table",
    index,
    width,
    depth,
    surfaceY: height + thickness / 2
  };

  return table;
}

export function createLaboratoryScene() {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x081323);
  scene.fog = new THREE.Fog(0x081323, 10, 25);

  const ambientLight = new THREE.HemisphereLight(
    0xbdeaff,
    0x25354b,
    2
  );

  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

  directionalLight.position.set(3, 7, 4);
  directionalLight.castShadow = true;

  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.left = -8;
  directionalLight.shadow.camera.right = 8;
  directionalLight.shadow.camera.top = 8;
  directionalLight.shadow.camera.bottom = -8;

  scene.add(directionalLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x10243a,
      roughness: 0.8,
      metalness: 0.15
    })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.visible = false;
  scene.add(floor);

  const grid = new THREE.GridHelper(
    12,
    24,
    0x38d9ff,
    0x23435f
  );

  grid.position.y = 0.005;
  grid.visible = false;
  scene.add(grid);

  const tables = TABLE_POSITIONS.map((position, index) => {
    const table = createTable(index, position);
    scene.add(table);
    return table;
  });

  return {
    scene,
    floor,
    tables
  };
}



