
import * as THREE from "three";
import * as CANNON from "cannon-es";

// =============================================
// NEXUS PHYSICS VR
// Manipulación con manos y física real
// =============================================

const PINCH_START = 0.035;
const PINCH_END = 0.055;

const GRAB_DISTANCE = 0.24;
const RAY_DISTANCE = 0.65;

const MAX_HAND_SPEED = 1.8;
const MAX_RELEASE_SPEED = 1.5;

const MIN_BODY_Y = 0.14;

const raycaster = new THREE.Raycaster();

const thumbPosition = new THREE.Vector3();
const indexPosition = new THREE.Vector3();
const wristPosition = new THREE.Vector3();

const pinchPosition = new THREE.Vector3();
const rayDirection = new THREE.Vector3();

function clampVector(vector, maximum) {
  const length = vector.length();

  if (length > maximum && length > 0) {
    vector.scale(maximum / length, vector);
  }

  return vector;
}

function getJointPosition(hand, name, target) {
  const joint = hand.joints?.[name];

  if (!joint || !joint.visible) {
    return false;
  }

  joint.getWorldPosition(target);

  return (
    Number.isFinite(target.x) &&
    Number.isFinite(target.y) &&
    Number.isFinite(target.z)
  );
}

function getHandPose(hand) {
  const hasThumb = getJointPosition(
    hand,
    "thumb-tip",
    thumbPosition
  );

  const hasIndex = getJointPosition(
    hand,
    "index-finger-tip",
    indexPosition
  );

  if (!hasThumb || !hasIndex) {
    return null;
  }

  const midpoint = thumbPosition.clone()
    .add(indexPosition)
    .multiplyScalar(0.5);

  const distance = thumbPosition.distanceTo(
    indexPosition
  );

  const hasWrist = getJointPosition(
    hand,
    "wrist",
    wristPosition
  );

  const direction = hasWrist
    ? indexPosition.clone()
        .sub(wristPosition)
        .normalize()
    : null;

  return {
    position: midpoint,
    distance,
    direction,
    indexTip: indexPosition.clone()
  };
}

// =============================================
// CREAR INTERACCIÓN
// =============================================

export function createHandInteraction({
  hands,
  pieces,
  renderer
}) {
  const states = hands.map(() => ({
    pinching: false,
    piece: null,
    offset: new THREE.Vector3(),
    target: new THREE.Vector3(),
    trackingLost: 0
  }));

  const selectableMeshes = pieces.map(
    piece => piece.mesh
  );

  function isAlreadyHeld(piece) {
    return states.some(
      state => state.piece === piece
    );
  }

  function findPiece(pose) {
    let nearest = null;
    let nearestDistance = GRAB_DISTANCE;

    // Selección cercana a los dedos.
    for (const piece of pieces) {
      if (
        piece.state === "clasificado" ||
        isAlreadyHeld(piece)
      ) {
        continue;
      }

      const distance = pose.position.distanceTo(
        piece.mesh.position
      );

      if (distance < nearestDistance) {
        nearest = piece;
        nearestDistance = distance;
      }
    }

    if (nearest) {
      return nearest;
    }

    // Selección alternativa mediante raycasting.
    if (!pose.direction) {
      return null;
    }

    raycaster.set(
      pose.indexTip,
      pose.direction
    );

    raycaster.near = 0;
    raycaster.far = RAY_DISTANCE;

    const intersections = raycaster.intersectObjects(
      selectableMeshes,
      false
    );

    for (const hit of intersections) {
      const piece = pieces.find(
        item => item.mesh === hit.object
      );

      if (
        piece &&
        piece.state !== "clasificado" &&
        !isAlreadyHeld(piece)
      ) {
        return piece;
      }
    }

    return null;
  }

  // ===========================================
  // AGARRAR UNA FIGURA
  // ===========================================

  function grabPiece(state, piece, pose) {
    const body = piece.body;

    // Conservamos la masa original.
    piece.originalMass ??= body.mass;

    body.type = CANNON.Body.KINEMATIC;
    body.mass = 0;

    body.updateMassProperties();

    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);

    body.wakeUp();

    // Conservar la distancia entre los dedos
    // y el centro de la figura al agarrarla.
    state.offset.set(
      body.position.x - pose.position.x,
      body.position.y - pose.position.y,
      body.position.z - pose.position.z
    );

    state.target.set(
      body.position.x,
      body.position.y,
      body.position.z
    );

    state.piece = piece;
    piece.state = "sujeto";

    console.log(
      `Figura ${piece.id} agarrada: ${piece.category}`
    );
  }

  // ===========================================
  // MOVER CUERPO CINEMÁTICO
  // ===========================================

  function moveHeldPiece(state, pose, delta) {
    const piece = state.piece;

    if (!piece) return;

    const body = piece.body;

    state.target.copy(pose.position)
      .add(state.offset);

    state.target.y = Math.max(
      MIN_BODY_Y,
      state.target.y
    );

    const seconds = Math.max(delta, 1 / 120);

    const movement = new CANNON.Vec3(
      state.target.x - body.position.x,
      state.target.y - body.position.y,
      state.target.z - body.position.z
    );

    movement.scale(
      1 / seconds,
      movement
    );

    clampVector(
      movement,
      MAX_HAND_SPEED
    );

    // cannon-es integra la velocidad
    // del cuerpo cinemático en el paso físico.
    body.velocity.copy(movement);
    body.angularVelocity.set(0, 0, 0);

    body.wakeUp();
  }

  // ===========================================
  // SOLTAR FIGURA
  // ===========================================

  function releasePiece(state, reason = "pinza") {
    const piece = state.piece;

    if (!piece) return;

    const body = piece.body;

    const releaseVelocity = body.velocity.clone();

    clampVector(
      releaseVelocity,
      MAX_RELEASE_SPEED
    );

    body.type = CANNON.Body.DYNAMIC;

    body.mass = piece.originalMass ?? 0.35;

    body.updateMassProperties();

    body.velocity.copy(releaseVelocity);
    body.angularVelocity.set(0, 0, 0);

    body.aabbNeedsUpdate = true;
    body.wakeUp();

    piece.state = "liberado";

    state.piece = null;

    console.log(
      `Figura ${piece.id} liberada (${reason})`
    );
  }

  // ===========================================
  // ACTUALIZAR SEGUIMIENTO
  // ===========================================

  function update(delta) {
    if (!renderer.xr.isPresenting) {
      return;
    }

    // Actualizar matrices de las manos.
    for (const hand of hands) {
      hand.updateWorldMatrix(true, true);
    }

    states.forEach((state, index) => {
      const pose = getHandPose(hands[index]);

      if (!pose) {
        state.trackingLost += delta;

        if (state.trackingLost > 0.15) {
          releasePiece(
            state,
            "seguimiento perdido"
          );

          state.pinching = false;
        }

        return;
      }

      state.trackingLost = 0;

      const isPinching = state.pinching
        ? pose.distance < PINCH_END
        : pose.distance < PINCH_START;

      // Inicio de la pinza.
      if (isPinching && !state.pinching) {
        state.pinching = true;

        const candidate = findPiece(pose);

        if (candidate) {
          grabPiece(
            state,
            candidate,
            pose
          );
        }
      }

      // Pinza sostenida.
      if (isPinching && state.piece) {
        moveHeldPiece(
          state,
          pose,
          delta
        );
      }

      // Apertura de los dedos.
      if (!isPinching && state.pinching) {
        releasePiece(state);
        state.pinching = false;
      }
    });
  }

  // ===========================================
  // LIBERACIÓN GENERAL
  // ===========================================

  function releaseAll() {
    for (const state of states) {
      releasePiece(
        state,
        "salida de VR"
      );

      state.pinching = false;
      state.trackingLost = 0;
    }
  }

  return {
    update,
    releaseAll,
    states
  };
}
