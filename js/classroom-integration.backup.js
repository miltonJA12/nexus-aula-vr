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

const TABLE_X = [0.55, 2.47, 4.39, 6.31];
const TABLE_Z = -6.15;

const BIN_CENTER_X = CLASSROOM.centerX;
const BIN_CENTER_Z = -1.35;

export const PLAYER_START = {
  x: CLASSROOM.centerX,
  y: 0,
  z: -3.65
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

  const staticBodies = world.bodies.filter(
    body => body.mass === 0
  );

  tables.forEach((table, index) => {
    const original = oldPositions[index];

    const dx = TABLE_X[index] - original.x;
    const dz = TABLE_Z - original.z;

    // Cambiar posicion del grupo visual.
    moveMesh(table, dx, dz);

    // Mover tablero y patas fisicas.
    for (const body of staticBodies) {
      const closeX =
        Math.abs(body.position.x - original.x) < 1.05;

      const closeZ =
        Math.abs(body.position.z - original.z) < 0.75;

      const isTableBody =
        body.position.y > 0.05 &&
        body.position.y < 1.1;

      if (closeX && closeZ && isTableBody) {
        moveBody(body, dx, dz);
      }
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

function relocateContainers({
  scene,
  containers,
  world
}) {
  // Posiciones originales de nuestro
  // modulo containers.js
  const originalShelfZ = 3.1;

  const dx = BIN_CENTER_X;
  const dz = BIN_CENTER_Z - originalShelfZ;

  const binParts = new Set();

  for (const container of containers) {
    for (const part of container.parts) {
      binParts.add(part.mesh);
    }
    binParts.add(container.label);
  }

  // Mover el soporte visual original.
  // Las partes de los botes se mueven
  // por separado en el siguiente bloque.
  for (const child of [...scene.children]) {
    if (!child.isMesh) continue;
    if (binParts.has(child)) continue;

    if (
      Math.abs(child.position.z - originalShelfZ) < 0.65 &&
      child.position.y > 0.05 &&
      child.position.y < 1.2
    ) {
      moveMesh(child, dx, dz);
    }
  }

  // Mover las piezas visuales y los datos
  // de posicion de cada recipiente.
  for (const container of containers) {
    for (const part of container.parts) {
      moveMesh(part.mesh, dx, dz);
    }

    moveMesh(container.label, dx, dz);

    container.position.x += dx;
    container.position.z += dz;

    container.interior.minX += dx;
    container.interior.maxX += dx;
    container.interior.minZ += dz;
    container.interior.maxZ += dz;
  }

  // Trasladar los cuerpos fisicos de
  // las bases, paredes y soporte.
  const staticBodies = world.bodies.filter(
    body => body.mass === 0
  );

  for (const body of staticBodies) {
    if (
      Math.abs(body.position.z - originalShelfZ) < 0.65 &&
      body.position.y > 0.05 &&
      body.position.y < 1.6
    ) {
      moveBody(body, dx, dz);
    }
  }
}

// ------------------------------------------
// POSICION DEL HUD
// ------------------------------------------

function relocateHUD(hud) {
  if (!hud?.board) return;

  hud.board.position.set(
    CLASSROOM.centerX,
    2.35,
    -8.05
  );

  // Orientado hacia el interior del salon.
  hud.board.rotation.set(0, 0, 0);
  hud.board.updateMatrixWorld(true);
}

// ------------------------------------------
// VISTA PREVIA EN ESCRITORIO
// ------------------------------------------

function configureDesktopCamera(camera, controls) {
  camera.position.set(
    6.45,
    2.55,
    -0.15
  );

  controls.target.set(
    CLASSROOM.centerX,
    1.05,
    -5.1
  );

  camera.lookAt(controls.target);
  controls.update();
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

  relocateHUD(hud);
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
    playerStart: PLAYER_START
  };

  return model;
}
