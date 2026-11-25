import * as THREE from "three";
import * as CANNON from "cannon-es";

// NEXUS_REMOTE_LASER_V8
// Seleccion de botones y figuras a distancia.

export function installHandLaserPointers({
  scene,
  renderer,
  hands,
  vrButtons,
  startGame,
  resetGame,
  pieces,
  game
}) {
  // NEXUS_LONG_RANGE_V10
// Alcance de seleccion de 12 metros.
const MAX_DISTANCE = 12;
  const WHITE = 0xffffff;
  const HOVER = 0x63ffac;

  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.03;
  raycaster.far = MAX_DISTANCE;

  const origin = new THREE.Vector3();
  const base = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const end = new THREE.Vector3();

  const cameraQuaternion = new THREE.Quaternion();
  const xrForward = new THREE.Vector3();
  const xrRight = new THREE.Vector3();
  const xrUp = new THREE.Vector3();
  const xrHeadPosition = new THREE.Vector3();

  const thumbPosition = new THREE.Vector3();
  const target = new THREE.Vector3();

  let lastButtonAction = -Infinity;

  // ============================================
  // CREAR PUNTEROS
  // ============================================

  const pointers = hands.map((hand, index) => {
    // Ocultar versiones antiguas.
    hand.traverse(object => {
      if (
        /^NEXUS_HAND_POINTER_V[12]$/.test(
          object.name
        )
      ) {
        object.visible = false;
      }
    });

    const geometry = new THREE.BufferGeometry();

    const positions = new THREE.BufferAttribute(
      new Float32Array(6),
      3
    );

    const distances = new THREE.BufferAttribute(
      new Float32Array(2),
      1
    );

    positions.setUsage(THREE.DynamicDrawUsage);
    distances.setUsage(THREE.DynamicDrawUsage);

    geometry.setAttribute("position", positions);
    geometry.setAttribute("lineDistance", distances);

    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({
        color: WHITE,
        dashSize: 0.045,
        gapSize: 0.025,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false
      })
    );

    line.name = "NEXUS_REMOTE_LASER_V8";
    line.frustumCulled = false;
    line.renderOrder = 120;
    line.userData.keepXRPosition = true;
    line.visible = false;

    scene.add(line);

    // Cursor circular como Meta Quest.
    const cursor = new THREE.Mesh(
      new THREE.RingGeometry(
        0.024,
        0.037,
        32
      ),
      new THREE.MeshBasicMaterial({
        color: WHITE,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      })
    );

    cursor.name = "NEXUS_REMOTE_CURSOR_V8";
    cursor.renderOrder = 121;
    cursor.userData.keepXRPosition = true;
    cursor.visible = false;

    scene.add(cursor);

    const pointer = {
      hand,
      index,
      line,
      cursor,
      positions,
      distances,
      hit: null,
      held: null,
      pressed: false,
      eventPinching: false,
      controllerHeld: false,
      handSelectHeld: false,
      keyboardHeld: false,
      pendingPress: false
    };

    // Eventos de pinza del visor.
    hand.addEventListener("pinchstart", () => {
      pointer.eventPinching = true;
      pointer.pendingPress = true;
    });

    hand.addEventListener("pinchend", () => {
      pointer.eventPinching = false;
    });

    // NEXUS_REMOTE_INPUT_V9
    // Seleccion mediante eventos WebXR.

    hand.addEventListener("selectstart", () => {
      pointer.handSelectHeld = true;
      pointer.pendingPress = true;
    });

    hand.addEventListener("selectend", () => {
      pointer.handSelectHeld = false;
    });

    const controller = renderer.xr.getController(index);

    controller.addEventListener("selectstart", () => {
      pointer.controllerHeld = true;
      pointer.pendingPress = true;
    });

    controller.addEventListener("selectend", () => {
      pointer.controllerHeld = false;
    });

    return pointer;
  });

  // ============================================
// ============================================
// PRUEBA DE SELECCION SIN VISOR FISICO
// ============================================

  window.addEventListener("keydown", event => {
    if (!renderer.xr.isPresenting) return;
    if (event.repeat) return;

    const index =
      event.code === "KeyZ" ? 0 :
      event.code === "KeyX" ? 1 : -1;

    if (index < 0) return;

    event.preventDefault();

    pointers[index].keyboardHeld = true;
    pointers[index].pendingPress = true;
  });

  window.addEventListener("keyup", event => {
    const index =
      event.code === "KeyZ" ? 0 :
      event.code === "KeyX" ? 1 : -1;

    if (index < 0) return;

    pointers[index].keyboardHeld = false;
  });

  window.addEventListener("blur", () => {
    pointers.forEach(pointer => {
      pointer.keyboardHeld = false;
    });
  });

  // ============================================
  // SOLTAR FIGURA REMOTA
  // ============================================

  function release(pointer) {
    const piece = pointer.held?.piece;

    if (piece && piece.state === "sujeto") {
      const body = piece.body;

      body.type = CANNON.Body.DYNAMIC;
      body.mass = piece.originalMass ?? 0.35;
      body.updateMassProperties();

      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.aabbNeedsUpdate = true;
      body.wakeUp();

      piece.state = "liberado";

      console.log(
        "NEXUS: figura liberada a distancia",
        piece.id
      );
    }

    pointer.held = null;
  }

  // ============================================
  // AGARRAR FIGURA REMOTA
  // ============================================

  function grab(pointer, piece, hit) {
    if (
      !piece ||
      piece.state === "sujeto" ||
      piece.state === "clasificado" ||
      piece._needsRecovery ||
      game.getState().status !== "jugando" ||
      pointers.some(p => p.held?.piece === piece)
    ) {
      return;
    }

    const body = piece.body;

    piece.originalMass ??= body.mass;

    body.type = CANNON.Body.KINEMATIC;
    body.mass = 0;
    body.updateMassProperties();

    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.wakeUp();

    piece.state = "sujeto";

    pointer.held = {
      piece,
      distance: THREE.MathUtils.clamp(
        hit.distance,
        0.6,
        MAX_DISTANCE
      ),
      offset: piece.mesh.position
        .clone()
        .sub(hit.point)
    };

    console.log(
      "NEXUS: figura agarrada a distancia",
      piece.id
    );
  }

  // ============================================
  // MOVER FIGURA CON EL LASER
  // ============================================

  // NEXUS_REMOTE_SYNC_V11
  // Agarre remoto sin retraso perceptible.

  // NEXUS_REMOTE_PHYSICS_V12
  // Movimiento mediante velocidad cinemática.
  // Mantiene sincronizados Cannon y Three.js.

  function moveHeld(pointer, delta) {
    const held = pointer.held;

    if (!held) return;

    const piece = held.piece;

    if (piece.state !== "sujeto") {
      pointer.held = null;
      return;
    }

    const body = piece.body;

    const dt = THREE.MathUtils.clamp(
      delta || 1 / 60,
      1 / 120,
      1 / 30
    );

    // Acercar figuras lejanas hasta 1.2 metros.
    if (held.pullTargetDistance === undefined) {
      held.pullTargetDistance = Math.min(
        held.distance,
        1.2
      );
    }

    // Atraccion de la figura sobre el rayo.
    held.distance = Math.max(
      held.pullTargetDistance,
      held.distance - 9.0 * dt
    );

    // Posicion objetivo desde el indice.
    target.copy(origin)
      .addScaledVector(
        direction,
        held.distance
      )
      .add(held.offset);

    target.y = Math.max(0.22, target.y);

    // Usar velocidad fisica, no teletransportar.
    const movement = new THREE.Vector3(
      target.x - body.position.x,
      target.y - body.position.y,
      target.z - body.position.z
    );

    const distance = movement.length();

    if (distance < 0.008) {
      body.velocity.set(0, 0, 0);
      return;
    }

    // Velocidad dinamica con limite seguro.
    const FOLLOW_SPEED = 16;

    movement.multiplyScalar(1 / dt);
    movement.clampLength(0, FOLLOW_SPEED);

    // Cannon integra esta velocidad
    // durante world.step().
    body.velocity.set(
      movement.x,
      movement.y,
      movement.z
    );

    body.angularVelocity.set(0, 0, 0);
    body.wakeUp();
  }

  function hide(pointer) {
    pointer.line.visible = false;
    pointer.cursor.visible = false;
    pointer.hit = null;
  }

  // ============================================
  // ACTUALIZAR CADA FOTOGRAMA
  // ============================================

  function update(delta = 1 / 60) {
    if (!renderer.xr.isPresenting) {
      for (const pointer of pointers) {
        release(pointer);
        hide(pointer);
        pointer.pressed = false;
        pointer.eventPinching = false;
      }
      return;
    }

    const xrCamera = renderer.xr.getCamera();

    xrCamera.updateWorldMatrix(true, false);

    xrCamera.getWorldQuaternion(
      cameraQuaternion
    );

    xrCamera.getWorldPosition(
      xrHeadPosition
    );

    // Direccion frontal del visor.
    xrForward.set(0, 0, -1)
      .applyQuaternion(cameraQuaternion)
      .normalize();

    xrRight.set(1, 0, 0)
      .applyQuaternion(cameraQuaternion)
      .normalize();

    xrUp.set(0, 1, 0)
      .applyQuaternion(cameraQuaternion)
      .normalize();

    for (const pointer of pointers) {
      const hand = pointer.hand;

      const tip =
        hand.joints?.["index-finger-tip"];

      const knuckle =
        hand.joints?.["index-finger-phalanx-proximal"] ||
        hand.joints?.["index-finger-metacarpal"] ||
        hand.joints?.wrist;

      const thumb =
        hand.joints?.["thumb-tip"];

      if (!tip || !knuckle) {
        release(pointer);
        hide(pointer);
        pointer.pressed = false;
        continue;
      }

      tip.updateWorldMatrix(true, false);
      knuckle.updateWorldMatrix(true, false);

      tip.getWorldPosition(origin);
      knuckle.getWorldPosition(base);

      direction.subVectors(origin, base);

      const length = direction.length();

      if (
        !Number.isFinite(length) ||
        length < 0.015 ||
        length > 0.50
      ) {
        release(pointer);
        hide(pointer);
        pointer.pressed = false;
        continue;
      }

      direction.normalize();

      const tilt = THREE.MathUtils.clamp(
        direction.dot(xrUp),
        -0.55,
        0.55
      );

      // Mantener ambos rayos separados.
      const sideDistance = origin.clone()
        .sub(xrHeadPosition)
        .dot(xrRight);

      const side = sideDistance < -0.02
        ? -1
        : sideDistance > 0.02
          ? 1
          : pointer.index === 0 ? -1 : 1;

      direction.copy(xrForward)
        .addScaledVector(
          xrRight,
          side * 0.08
        )
        .addScaledVector(
          xrUp,
          tilt * 0.40
        )
        .normalize();

      raycaster.set(origin, direction);

      // ========================================
      // DETECTAR BOTONES Y FIGURAS
      // ========================================

      const buttonMeshes = vrButtons
        .filter(b => b.mesh?.visible)
        .map(b => b.mesh);

      const pieceMeshes =
        game.getState().status === "jugando"
          ? pieces
              .filter(p =>
                p.state !== "clasificado" &&
                p.state !== "sujeto" &&
                !p._needsRecovery
              )
              .map(p => p.mesh)
          : [];

      let hits = raycaster.intersectObjects(
        [...buttonMeshes, ...pieceMeshes],
        false
      );

      // Si el rayo pasa muy cerca del objeto,
      // permitir seleccion con una tolerancia pequena.
      if (hits.length === 0) {
        const center = new THREE.Vector3();
        let best = null;

        for (const mesh of [...buttonMeshes, ...pieceMeshes]) {
          mesh.updateWorldMatrix(true, false);
          mesh.getWorldPosition(center);

          const along =
            (center.x - origin.x) * direction.x +
            (center.y - origin.y) * direction.y +
            (center.z - origin.z) * direction.z;

          if (along < 0.28 || along > MAX_DISTANCE) {
            continue;
          }

          const radius = buttonMeshes.includes(mesh)
            ? 0.34
            : 0.24;

          const miss = Math.sqrt(
            raycaster.ray.distanceSqToPoint(center)
          );

          if (
            miss <= radius &&
            (!best || miss < best.miss)
          ) {
            best = {
              object: mesh,
              point: origin.clone().addScaledVector(
                direction,
                along
              ),
              distance: along,
              miss
            };
          }
        }

        if (best) {
          hits = [best];
        }
      }

      pointer.hit = null;

      end.copy(origin).addScaledVector(
        direction,
        MAX_DISTANCE
      );

      let color = WHITE;

      if (pointer.held) {
        end.copy(origin).addScaledVector(
          direction,
          pointer.held.distance
        );

        color = HOVER;
      }
      else if (hits.length > 0) {
        const hit = hits[0];

        const button = vrButtons.find(
          b => b.mesh === hit.object
        );

        const piece = pieces.find(
          p => p.mesh === hit.object
        );

        pointer.hit = {
          button,
          piece,
          distance: hit.distance,
          point: hit.point.clone()
        };

        end.copy(hit.point);
        color = HOVER;
      }

      // ========================================
      // DIBUJAR RAYO SIN DESPLAZAMIENTO
      // ========================================

      pointer.line.position.set(0, 0, 0);
      pointer.line.quaternion.identity();
      pointer.line.scale.set(1, 1, 1);
      pointer.line.updateMatrixWorld(true);

      const pos = pointer.positions;

      pos.setXYZ(
        0,
        origin.x,
        origin.y,
        origin.z
      );

      pos.setXYZ(
        1,
        end.x,
        end.y,
        end.z
      );

      pos.needsUpdate = true;

      pointer.distances.setX(0, 0);

      pointer.distances.setX(
        1,
        origin.distanceTo(end)
      );

      pointer.distances.needsUpdate = true;

      pointer.line.material.color.setHex(
        color
      );

      pointer.cursor.position.copy(end);
      pointer.cursor.quaternion.copy(
        cameraQuaternion
      );

      pointer.cursor.material.color.setHex(
        color
      );

      pointer.line.visible = true;
      pointer.cursor.visible = true;

      // ========================================
      // DETECTAR PINZA CONTINUA
      // ========================================

      let pinching =
        pointer.eventPinching ||
        pointer.handSelectHeld ||
        pointer.controllerHeld ||
        pointer.keyboardHeld;

      if (thumb) {
        thumb.updateWorldMatrix(true, false);
        thumb.getWorldPosition(thumbPosition);

        const pinchDistance =
          thumbPosition.distanceTo(origin);

        if (Number.isFinite(pinchDistance)) {
          pinching = pinching ||
            pinchDistance <
              (pointer.pressed ? 0.075 : 0.050);
        }
      }

      // Una accion por cada pinza nueva.
      if (
        (pinching && !pointer.pressed) ||
        pointer.pendingPress
      ) {
        pointer.pendingPress = false;

        console.log("NEXUS V9: seleccion detectada", {
          mano: pointer.index,
          boton: pointer.hit?.button?.label ?? null,
          figura: pointer.hit?.piece?.id ?? null,
          estado: game.getState().status
        });
        const selected = pointer.hit;

        // A distancia. El sistema original
        // sigue gestionando el contacto cercano.
        if (
          selected &&
          selected.distance > 0.28
        ) {
          if (selected.button) {
            const action =
              selected.button.action;

            const now = performance.now();

            if (
              (action === startGame ||
               action === resetGame) &&
              now - lastButtonAction > 650
            ) {
              if (action === resetGame) {
                pointers.forEach(release);
              }

              lastButtonAction = now;
              action();

              console.log(
                "NEXUS: boton activado a distancia",
                selected.button.label
              );
            }
          }
          else if (selected.piece) {
            grab(
              pointer,
              selected.piece,
              selected
            );
          }
        }
      }

      // Abrir los dedos suelta el objeto.
      if (!pinching && pointer.pressed) {
        release(pointer);
      }

      pointer.pressed = pinching;

      if (pointer.held && pinching) {
        moveHeld(pointer, delta);
      }
    }
  }

  // ============================================
  // LIMPIAR AL SALIR DE VR
  // ============================================

  renderer.xr.addEventListener(
    "sessionend",
    () => {
      for (const pointer of pointers) {
        release(pointer);
        hide(pointer);

        pointer.pressed = false;
        pointer.eventPinching = false;
      }
    }
  );

  console.log(
    "NEXUS: seleccion y movimiento remoto preparados"
  );

  return {
    update,
    pointers,
    releaseAll: () => pointers.forEach(release)
  };
}