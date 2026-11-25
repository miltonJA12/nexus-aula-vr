import * as THREE from "three";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

// ------------------------------------------
// MEDIDAS DEL SALON IMPORTADO DESDE SKETCHUP
// ------------------------------------------

export const CLASSROOM = {
  minX: -0.610,
  maxX: 7.500,
  minZ: -8.600,
  maxZ: 0.754,
  height: 3.200,
  centerX: 3.445,
  centerZ: -3.923
};

// Distribucion lineal dentro del salon.
//
// Pizarron: zona Z negativa.
// Mesas: frente del jugador.
// Recipientes: parte posterior.

const TABLE_X = [1.15, 2.65, 4.15, 5.65];
const TABLE_Z = -5.15;

const BIN_CENTER_X = CLASSROOM.centerX;
const BIN_CENTER_Z = -2.35;

export const PLAYER_START = {
  x: 3.445,
  y: 0,
  z: -3.923
};

// ------------------------------------------
// UTILIDADES FISICAS
// ------------------------------------------

function near(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

function moveBody(body, dx, dz) {
  body.position.x += dx;
  body.position.z += dz;

  body.aabbNeedsUpdate = true;
  body.updateAABB();

  if (body.mass > 0) {
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.wakeUp();
  }
}

function moveMesh(mesh, dx, dz) {
  mesh.position.x += dx;
  mesh.position.z += dz;
  mesh.updateMatrixWorld(true);
}

// ------------------------------------------
// RECOLOCAR MESAS Y FIGURAS
// ------------------------------------------

function relocateTables({
  tables,
  pieces,
  world
}) {
  const oldPositions = tables.map(table => ({
    x: table.position.x,
    z: table.position.z
  }));

  // El motor crea exactamente cinco colisionadores por mesa:
  // 1 tablero y 4 patas, después del cuerpo del suelo.
  // Al usar sus índices evitamos mover dos veces cuerpos de mesas vecinas.
  const tableBodies = world.bodies.filter(body => body.mass === 0).slice(1, 21);
  if (tableBodies.length !== 20) {
    throw new Error("No se encontraron los 20 cuerpos de las 4 mesas");
  }

    // NEXUS_PASILLOS_AUTOMATICOS
  // Centrar las cuatro mesas en el ancho del salon.
  // Conserva mallas, figuras y cuerpos fisicos.

  const anchoSalon = CLASSROOM.maxX - CLASSROOM.minX;

  const anchoMesa = Math.max(
    ...tables.map(t => t.userData.width || 1.38)
  );

  const separacionMesas = 0.17;

  const anchoFila =
    tables.length * anchoMesa +
    (tables.length - 1) * separacionMesas;

  const pasillo = (anchoSalon - anchoFila) / 2;

  if (pasillo < 0.90) {
    console.warn(
      "NEXUS: pasillos menores de 90 cm",
      pasillo
    );
  }

  const centroSalon =
    (CLASSROOM.minX + CLASSROOM.maxX) / 2;

  const inicio =
    centroSalon - anchoFila / 2 + anchoMesa / 2;
  // NEXUS_AJUSTE_CENTRADO_030

  const tableCentersX = tables.map(
    (_, index) =>
      inicio + index * (anchoMesa + separacionMesas)
  );

  console.table({
    anchoSalon: anchoSalon.toFixed(2),
    anchoMesa: anchoMesa.toFixed(2),
    pasilloIzquierdo: pasillo.toFixed(2),
    pasilloDerecho: pasillo.toFixed(2),
    separacionMesas: separacionMesas.toFixed(2)
  });
tables.forEach((table, index) => {
    const original = oldPositions[index];
    const dx = tableCentersX[index] - original.x;
    const dz = TABLE_Z - original.z;
    moveMesh(table, dx, dz);

    for (const body of tableBodies.slice(index * 5, index * 5 + 5)) {
      moveBody(body, dx, dz);
    }

    // Desplazar cada figura conservando
    // su posicion relativa sobre la mesa.
    const tablePieces = pieces.filter(
      piece => piece.tableIndex === index
    );

    for (const piece of tablePieces) {
      moveBody(piece.body, dx, dz);

      piece.mesh.position.copy(
        piece.body.position
      );
    }
  });
}

// ------------------------------------------
// RECOLOCAR RECIPIENTES Y SOPORTE
// ------------------------------------------

function relocateContainers({ scene, containers, world }) {
  const originalZ = 3.1;
  const dx = BIN_CENTER_X;
  const dz = BIN_CENTER_Z - originalZ;

  // Cada parte contiene la malla y su cuerpo fisico: mover ambos juntos.
  const containerMeshes = new Set();
  const containerBodies = new Set();

  for (const container of containers) {
    for (const part of container.parts) {
      containerMeshes.add(part.mesh);
      containerBodies.add(part.body);
      moveMesh(part.mesh, dx, dz);
      moveBody(part.body, dx, dz);
    }
    containerMeshes.add(container.label);
    moveMesh(container.label, dx, dz);
    container.position.x += dx;
    container.position.z += dz;
    container.interior.minX += dx;
    container.interior.maxX += dx;
    container.interior.minZ += dz;
    container.interior.maxZ += dz;
  }

  // Soporte original de los cuatro recipientes (tablero y 4 patas).
  // Identificacion limitada por X, Y y Z, no por distancia general.
  const shelfBodies = world.bodies.filter(body =>
    body.mass === 0 &&
    !containerBodies.has(body) &&
    Math.abs(body.position.z - originalZ) < 0.65 &&
    body.position.y > 0.05 && body.position.y < 0.85 &&
    (Math.abs(body.position.x) < 0.06 ||
     Math.abs(Math.abs(body.position.x) - 1.62) < 0.06)
  );
  shelfBodies.forEach(body => moveBody(body, dx, dz));

  // Los objetos visuales del soporte estan directamente en scene.
  for (const mesh of scene.children) {
    if (!mesh.isMesh || containerMeshes.has(mesh)) continue;
    if (Math.abs(mesh.position.z - originalZ) >= 0.65) continue;
    if (mesh.position.y <= 0.05 || mesh.position.y >= 0.85) continue;
    if (Math.abs(mesh.position.x) < 0.06 ||
        Math.abs(Math.abs(mesh.position.x) - 1.62) < 0.06) {
      moveMesh(mesh, dx, dz);
    }
  }
}

// ------------------------------------------
// POSICION DEL HUD
// ------------------------------------------

// Localizar la malla verde del pizarron a partir del GLB,
// evitando confundirla con las paredes y los recipientes.
function findGreenBoard(model) {
  const candidates = [];
  model.updateWorldMatrix(true, true);
  model.traverse(object => {
    if (!object.isMesh) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    if (size.y < 0.55 || size.x < 1.6 || size.z > 0.45) return;

    const mats = Array.isArray(object.material) ? object.material : [object.material];
    let looksGreen = false;
    for (const mat of mats) {
      if (!mat) continue;
      const name = `${mat.name || ""} ${object.name || ""}`.toLowerCase();
      if (/pizarr|chalkboard|blackboard|whiteboard|tablero/.test(name)) {
        looksGreen = true;
        break;
      }
      if (!mat.color) continue;
      const { r, g, b } = mat.color;
      if (g > r * 1.25 && g > b * 1.05 && g > 0.035 && r < 0.48) {
        looksGreen = true;
      }
    }
    if (!looksGreen) return;
    const center = box.getCenter(new THREE.Vector3());
    const score = size.x * 2 + size.y + (size.z < 0.16 ? 4 : 0);
    candidates.push({ box, size, center, score, name: object.name });
  });
  return candidates.sort((a, b) => b.score - a.score)[0] || null;
}

function relocateHUD(hud, model) {
  if (!hud?.board) return;

  const green = findGreenBoard(model);
  const roomCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  let point;
  let normalZ;

  if (green) {
    // Superficie interior: la que mira hacia el centro de la habitacion.
    normalZ = roomCenter.z < green.center.z ? -1 : 1;
    point = green.center.clone();
    point.z += normalZ * (green.size.z / 2 + 0.075);
    console.info("NEXUS: pizarron verde localizado", {
      nombre: green.name,
      posicion: green.center.toArray(),
      dimensiones: green.size.toArray()
    });
  } else {
    // Si SketchUp exporto el pizarron con material sin verde reconocible,
    // colocar provisionalmente en la cara interior del muro del extremo +Z.
    normalZ = -1;
    point = new THREE.Vector3(CLASSROOM.centerX, 1.52, CLASSROOM.maxZ - 0.46);
    console.warn("NEXUS: no se identifico la malla verde; HUD en posicion provisional");
  }

  hud.board.position.copy(point);
  hud.board.rotation.set(0, normalZ < 0 ? Math.PI : 0, 0);
  // El pizarron fisico suele medir 1.2 m de altura: caber sobre el sin salir.
  hud.board.scale.setScalar(0.86);
  hud.board.material.depthTest = false;
  hud.board.material.depthWrite = false;
  hud.board.renderOrder = 30;
  hud.board.updateMatrixWorld(true);
}

function configureDesktopCamera(camera, controls) {
  // Coordenadas nuevas: el centro del salón será el origen (0,0,0).
  camera.position.set(7.5, 6.0, 8.5);
  controls.target.set(0, 1.15, 0);
  camera.lookAt(controls.target);
  controls.update();
}

// Trasladar EL MUNDO (visual y físico), nunca la cámara WebXR.
// Así los emuladores que ignoran offsets entran directamente al salón.
function centerWorldAtPlayer({ scene, world, containers, model, hud, tables, pieces }) {
  const dx = -CLASSROOM.centerX;
  const dz = -CLASSROOM.centerZ;

  // Solo se ejecuta una vez después de importar el modelo.
  // La UI VR, las manos y la cámara aún no son parte del escenario físico.
  for (const child of scene.children) {
    if (child.isLight || child.isCamera || child.userData?.keepXRPosition) continue;
    if (child.isGridHelper) continue;
    if (child.name === "Controles XR") continue;
    child.position.x += dx;
    child.position.z += dz;
    child.updateMatrixWorld(true);
  }

  for (const body of world.bodies) {
    body.position.x += dx;
    body.position.z += dz;
    body.aabbNeedsUpdate = true;
    body.updateAABB();
    if (body.mass > 0) {
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.wakeUp();
    }
  }

  // El suelo invisible anterior debe seguir cubriendo TODO el salón.
  const floor = world.bodies.find(body =>
    body.mass === 0 && Math.abs(body.position.y + 0.1) < 0.01
  );
  if (floor) {
    floor.position.x = 0;
    floor.position.z = 0;
    floor.aabbNeedsUpdate = true;
    floor.updateAABB();
  }

  for (const bin of containers) {
    bin.position.x += dx;
    bin.position.z += dz;
    bin.interior.minX += dx;
    bin.interior.maxX += dx;
    bin.interior.minZ += dz;
    bin.interior.maxZ += dz;
  }

  world.broadphase.dirty = true;
  console.info("SALON CENTRADO: jugador inicia en 0,0,0", {
    dx, dz,
    mesas: tables.map(t => [t.position.x, t.position.z]),
    cajas: containers.map(b => [b.position.x, b.position.z]),
    marcador: hud?.board?.position.toArray()
  });
}

// ------------------------------------------
// CARGAR MODELO SKETCHUP
// ------------------------------------------

export async function integrateClassroom({
  scene,
  world,
  tables,
  pieces,
  containers,
  hud,
  camera,
  controls,
  renderer
}) {
  const loader = new GLTFLoader();

  const gltf = await loader.loadAsync(
    "./assets/models/salon-clases.glb"
  );

  const model = gltf.scene;
  model.name = "Salon SketchUp 2025";

  scene.add(model);
  // La niebla azul anterior oscurecia el interior del salon.
  scene.fog = null;

  model.traverse(object => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;

    // Conservar los materiales importados.
  });

  // Ocultar las cuadrículas de referencia
  // del escenario anterior.
  scene.traverse(object => {
    if (object.isGridHelper) {
      object.visible = false;
    }
  });

  relocateTables({
    tables,
    pieces,
    world
  });

  relocateContainers({
    scene,
    containers,
    world
  });

  centerWorldAtPlayer({ scene, world, containers, model, hud, tables, pieces });
  // IMPORTANTE: mover el HUD DESPUES de centrar el escenario.
  // Se posiciona usando la malla verde, no coordenadas previas al traslado.
  relocateHUD(hud, model);
  configureDesktopCamera(camera, controls);

  // Tras mover cuerpos estaticos, actualizar
  // el broadphase de cannon-es.
  world.broadphase.dirty = true;

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());

  console.log("SALON INTEGRADO AL LABORATORIO VR");

  console.table({
    ancho: size.x.toFixed(3),
    altura: size.y.toFixed(3),
    profundidad: size.z.toFixed(3),
    mesas: tables.length,
    figuras: pieces.length,
    recipientes: containers.length,
    cuerposFisicos: world.bodies.length
  });

  // Herramienta para revisar posiciones.
  window.CLASSROOM_LAYOUT = {
    model,
    bounds,
    tables,
    pieces,
    containers,
    hud: hud.board,
    playerStart: { x: 0, y: 0, z: 0 },
    repositionHUD: () => relocateHUD(hud, model)
  };

  return model;
}








