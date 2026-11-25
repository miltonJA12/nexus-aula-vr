
import * as THREE from "three";
import { CATEGORIES } from "./pieces.js";

// Posiciones de los cuatro recipientes.
export const CONTAINER_POSITIONS = [
  { x: -1.70, z: 3.1 },
  { x: -0.57, z: 3.1 },
  { x: 0.57, z: 3.1 },
  { x: 1.70, z: 3.1 }
];

export const CONTAINER_SIZE = {
  width: 0.94,
  depth: 0.94,
  height: 0.58,
  wallThickness: 0.06,
  baseThickness: 0.08
};

const SHELF = {
  centerY: 0.75,
  thickness: 0.1,
  width: 4.45,
  depth: 1.25,
  z: 3.1
};

const shelfTop = SHELF.centerY + SHELF.thickness / 2;

function createMaterial(color, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.2,
    transparent: opacity < 1,
    opacity
  });
}

// Crea simultáneamente una malla visible y
// un cuerpo físico estático del mismo tamaño.
function createPhysicalBox(
  scene,
  addStaticBox,
  position,
  size,
  material,
  parent = scene
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    material
  );

  mesh.position.set(
    position.x,
    position.y,
    position.z
  );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  parent.add(mesh);

  const body = addStaticBox(position, size);

  return { mesh, body };
}

function createLabel(text, color) {
  const canvas = document.createElement("canvas");

  canvas.width = 512;
  canvas.height = 160;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0b192c";
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, 504, 152);

  ctx.font = "bold 51px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 256, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true
  });

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.27),
    material
  );

  return label;
}

function createShelf(scene, addStaticBox) {
  const shelfMaterial = createMaterial(0x193a59);
  const legMaterial = createMaterial(0x627d99);

  // Tablero de soporte para los cuatro botes.
  createPhysicalBox(
    scene,
    addStaticBox,
    {
      x: 0,
      y: SHELF.centerY,
      z: SHELF.z
    },
    {
      x: SHELF.width,
      y: SHELF.thickness,
      z: SHELF.depth
    },
    shelfMaterial
  );

  // Cuatro patas.
  const legHeight = SHELF.centerY - SHELF.thickness / 2;

  for (const x of [-2.05, 2.05]) {
    for (const dz of [-0.45, 0.45]) {
      createPhysicalBox(
        scene,
        addStaticBox,
        {
          x,
          y: legHeight / 2,
          z: SHELF.z + dz
        },
        {
          x: 0.09,
          y: legHeight,
          z: 0.09
        },
        legMaterial
      );
    }
  }
}

function createContainer(
  scene,
  addStaticBox,
  category,
  position
) {
  const {
    width,
    depth,
    height,
    wallThickness,
    baseThickness
  } = CONTAINER_SIZE;

  const parts = [];

  const baseCenterY = shelfTop + baseThickness / 2;
  const interiorFloorY = baseCenterY + baseThickness / 2;

  const wallCenterY = interiorFloorY + height / 2;

  const material = createMaterial(category.color, 0.87);
  const baseMaterial = createMaterial(category.color, 1);

  // Base física.
  parts.push(createPhysicalBox(
    scene,
    addStaticBox,
    {
      x: position.x,
      y: baseCenterY,
      z: position.z
    },
    {
      x: width,
      y: baseThickness,
      z: depth
    },
    baseMaterial
  ));

  // Paredes izquierda y derecha.
  for (const side of [-1, 1]) {
    parts.push(createPhysicalBox(
      scene,
      addStaticBox,
      {
        x: position.x + side * (width / 2 - wallThickness / 2),
        y: wallCenterY,
        z: position.z
      },
      {
        x: wallThickness,
        y: height,
        z: depth
      },
      material
    ));
  }

  // Paredes frontal y posterior.
  for (const side of [-1, 1]) {
    parts.push(createPhysicalBox(
      scene,
      addStaticBox,
      {
        x: position.x,
        y: wallCenterY,
        z: position.z + side * (depth / 2 - wallThickness / 2)
      },
      {
        x: width - 2 * wallThickness,
        y: height,
        z: wallThickness
      },
      material
    ));
  }

  // Etiqueta frontal.
  const label = createLabel(category.name, category.color);

  label.position.set(
    position.x,
    wallCenterY + 0.08,
    position.z + depth / 2 + 0.012
  );

  scene.add(label);

  // Volumen interior que utilizaremos más adelante
  // para validar los depósitos.
  const interior = {
    minX: position.x - width / 2 + wallThickness,
    maxX: position.x + width / 2 - wallThickness,
    minZ: position.z - depth / 2 + wallThickness,
    maxZ: position.z + depth / 2 - wallThickness,
    floorY: interiorFloorY,
    rimY: interiorFloorY + height
  };

  return {
    id: category.id,
    name: category.name,
    color: category.color,
    position: { ...position },
    interior,
    parts,
    label,
    count: 0,
    capacity: 5
  };
}

export function createContainers(scene, addStaticBox) {
  createShelf(scene, addStaticBox);

  const containers = CATEGORIES.map((category, index) =>
    createContainer(
      scene,
      addStaticBox,
      category,
      CONTAINER_POSITIONS[index]
    )
  );

  return containers;
}
