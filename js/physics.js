
import * as CANNON from "cannon-es";
import { TABLE_POSITIONS, TABLE_SIZE } from "./scene.js";

export const FIXED_STEP = 1 / 60;

export function createPhysicsWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
  });

  const broadphase = new CANNON.SAPBroadphase(world);

  world.broadphase = broadphase;

  broadphase.dirty = true;
  world.solver.iterations = 20;
  world.solver.tolerance = 0.0005;

  world.allowSleep = true;

  world.defaultContactMaterial.friction = 0.55;
  world.defaultContactMaterial.restitution = 0.16;

  const staticBodies = [];


  function addStaticBox(position, size) {
    const shape = new CANNON.Box(
      new CANNON.Vec3(
        size.x / 2,
        size.y / 2,
        size.z / 2
      )
    );

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      position: new CANNON.Vec3(
        position.x,
        position.y,
        position.z
      ),
      shape
    });

    body.collisionResponse = true;
    body.collisionFilterGroup = 1;
    body.collisionFilterMask = -1;

    // Actualiza explícitamente los límites
    // físicos en coordenadas del mundo.
    body.aabbNeedsUpdate = true;
    body.updateAABB();

    world.addBody(body);
    staticBodies.push(body);

    return body;
  }


  // Suelo: su cara superior queda en y = 0.
  addStaticBox(
    { x: 0, y: -0.1, z: 0 },
    { x: 12, y: 0.2, z: 12 }
  );

  // Superficie y cuatro patas de cada mesa.
  TABLE_POSITIONS.forEach(({ x, z }) => {
    const { width, depth, height, thickness } = TABLE_SIZE;

    addStaticBox(
      { x, y: height, z },
      { x: width, y: thickness, z: depth }
    );

    const legHeight = height - thickness / 2;

    for (const dx of [
      -width / 2 + 0.15,
      width / 2 - 0.15
    ]) {
      for (const dz of [
        -depth / 2 + 0.15,
        depth / 2 - 0.15
      ]) {
        addStaticBox(
          {
            x: x + dx,
            y: legHeight / 2,
            z: z + dz
          },
          {
            x: 0.09,
            y: legHeight,
            z: 0.09
          }
        );
      }
    }
  });

  return {
    world,
    staticBodies,
    addStaticBox
  };
}
