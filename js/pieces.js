
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { TABLE_POSITIONS, TABLE_SIZE } from "./scene.js";

export const CATEGORIES = [
  { id: "esfera", name: "Esfera", color: 0x38aaff },
  { id: "cubo", name: "Cubo", color: 0xff647b },
  { id: "piramide", name: "Pirámide", color: 0xffd166 },
  { id: "prisma", name: "Prisma", color: 0x55e6ac }
];

const HEIGHT = 0.28;
const RADIUS = 0.15;

// Convierte caras poligonales en caras con normales exteriores.
function convexShape(vertices, rawFaces) {
  const center = new THREE.Vector3();

  vertices.forEach(v => center.add(
    new THREE.Vector3(v.x, v.y, v.z)
  ));

  center.divideScalar(vertices.length);

  const faces = rawFaces.map(face => {
    const a = vertices[face[0]];
    const b = vertices[face[1]];
    const c = vertices[face[2]];

    const va = new THREE.Vector3(a.x, a.y, a.z);
    const vb = new THREE.Vector3(b.x, b.y, b.z);
    const vc = new THREE.Vector3(c.x, c.y, c.z);

    const normal = vb.clone().sub(va).cross(
      vc.clone().sub(va)
    );

    const faceCenter = new THREE.Vector3();

    face.forEach(index => {
      const v = vertices[index];
      faceCenter.add(new THREE.Vector3(v.x, v.y, v.z));
    });

    faceCenter.divideScalar(face.length);

    const outward = faceCenter.sub(center);

    return normal.dot(outward) >= 0
      ? face
      : [...face].reverse();
  });

  return new CANNON.ConvexPolyhedron({
    vertices,
    faces
  });
}

function pyramidCollider() {
  const vertices = [];

  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;

    vertices.push(new CANNON.Vec3(
      Math.sin(angle) * RADIUS,
      -HEIGHT / 2,
      Math.cos(angle) * RADIUS
    ));
  }

  vertices.push(new CANNON.Vec3(0, HEIGHT / 2, 0));

  return convexShape(vertices, [
    [0, 1, 2, 3],
    [0, 1, 4],
    [1, 2, 4],
    [2, 3, 4],
    [3, 0, 4]
  ]);
}

function prismCollider() {
  const vertices = [];

  for (const y of [-HEIGHT / 2, HEIGHT / 2]) {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;

      vertices.push(new CANNON.Vec3(
        Math.sin(angle) * RADIUS,
        y,
        Math.cos(angle) * RADIUS
      ));
    }
  }

  const faces = [
    [0, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11]
  ];

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;

    faces.push([
      i,
      next,
      next + 6,
      i + 6
    ]);
  }

  return convexShape(vertices, faces);
}

function createGeometry(category) {
  switch (category) {
    case "esfera":
      return new THREE.SphereGeometry(0.14, 20, 14);

    case "cubo":
      return new THREE.BoxGeometry(0.26, 0.26, 0.26);

    case "piramide":
      return new THREE.CylinderGeometry(
        0, RADIUS, HEIGHT, 4
      );

    case "prisma":
      return new THREE.CylinderGeometry(
        RADIUS, RADIUS, HEIGHT, 6
      );

    default:
      throw new Error("Categoría desconocida");
  }
}

function createCollider(category) {
  switch (category) {
    case "esfera":
      return new CANNON.Sphere(0.14);

    case "cubo":
      return new CANNON.Box(
        new CANNON.Vec3(0.13, 0.13, 0.13)
      );

    case "piramide":
      return pyramidCollider();

    case "prisma":
      return prismCollider();

    default:
      throw new Error("Colisionador desconocido");
  }
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// Cada mesa recibe una pieza de cada categoría.
// Las cuatro piezas restantes se reparten una por mesa.
function createDistribution() {
  const distribution = Array.from(
    { length: 4 },
    () => []
  );

  CATEGORIES.forEach(category => {
    for (let table = 0; table < 4; table++) {
      distribution[table].push(category);
    }
  });

  const extraTables = shuffle([0, 1, 2, 3]);

  CATEGORIES.forEach((category, index) => {
    distribution[extraTables[index]].push(category);
  });

  return distribution.map(shuffle);
}

const SLOTS = [
  [-0.42, -0.20],
  [0, -0.20],
  [0.42, -0.20],
  [-0.22, 0.20],
  [0.22, 0.20]
];

export function createPieces(scene, world) {
  const pieces = [];
  const distribution = createDistribution();

  let id = 0;

  distribution.forEach((categories, tableIndex) => {
    const table = TABLE_POSITIONS[tableIndex];
    const slots = shuffle(SLOTS);

    categories.forEach((category, slotIndex) => {
      const [dx, dz] = slots[slotIndex];

      const geometry = createGeometry(category.id);

      const material = new THREE.MeshStandardMaterial({
        color: category.color,
        roughness: 0.42,
        metalness: 0.12
      });

      const mesh = new THREE.Mesh(geometry, material);

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const body = new CANNON.Body({
        mass: 0.35,
        material: new CANNON.Material({
          friction: 0.55,
          restitution: 0.16
        }),
        linearDamping: 0.18,
        angularDamping: 0.35,
        allowSleep: true,
        sleepSpeedLimit: 0.1,
        sleepTimeLimit: 0.8
      });

      body.addShape(createCollider(category.id));

      const smallOffsetX = (Math.random() - 0.5) * 0.03;
      const smallOffsetZ = (Math.random() - 0.5) * 0.03;

      const surfaceY =
        TABLE_SIZE.height + TABLE_SIZE.thickness / 2;

      const spawnHeight = surfaceY + 0.30;

      body.position.set(
        table.x + dx + smallOffsetX,
        spawnHeight,
        table.z + dz + smallOffsetZ
      );

      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);

      const angle = Math.random() * Math.PI * 2;

      body.quaternion.setFromAxisAngle(
        new CANNON.Vec3(0, 1, 0),
        angle
      );

      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);

      world.addBody(body);
      scene.add(mesh);

      const piece = {
        id: ++id,
        category: category.id,
        tableIndex,
        mesh,
        body,
        state: "disponible"
      };

      mesh.userData.pieceId = id;

      pieces.push(piece);
    });
  });

  return pieces;
}

export function syncPieces(pieces) {
  for (const piece of pieces) {
    const { mesh, body } = piece;

    mesh.position.set(
      body.position.x,
      body.position.y,
      body.position.z
    );

    mesh.quaternion.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w
    );
  }
}
