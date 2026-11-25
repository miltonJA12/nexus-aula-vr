import { installVRReferenceButtons } from "./vr-reference-buttons.js";
import {
  integrateClassroom
} from "./classroom-integration.js";

import * as THREE from "three";

import {
  OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
  createLaboratoryScene
} from "./scene.js";

import {
  createPhysicsWorld,
  FIXED_STEP
} from "./physics.js";

import {
  createPieces,
  syncPieces,
  CATEGORIES
} from "./pieces.js";

import {
  createContainers
} from "./containers.js";

import {
  setupXR
} from "./xr.js";

import {
  createHandInteraction
} from "./interaction.js";

import {
  createGame
} from "./game.js";

import {
  createHUD
} from "./hud.js";

// ============================================
// TALLER DE FORMAS - PRÁCTICA 3.2
// Three.js + cannon-es + WebXR
// ============================================

// 1. ELEMENTOS HTML

const container = document.getElementById("scene-container");
const placeholder = document.getElementById("scene-placeholder");
const status = document.getElementById("lab-status");
const xrStatus = document.getElementById("xr-status");

const startVRButton = document.getElementById("start-vr");
const resetButton = document.getElementById("reset-lab");

if (!container) {
  throw new Error("No se encontró #scene-container");
}

// 2. ESCENARIO

const {
  scene,
  tables
} = createLaboratoryScene();

// 3. MOTOR DE FÍSICA

const {
  world,
  staticBodies,
  addStaticBox
} = createPhysicsWorld();

// 4. RECIPIENTES

const containers = createContainers(
  scene,
  addStaticBox
);

// 5. FIGURAS

const pieces = createPieces(scene, world);

world.broadphase.dirty = true;

// 6. CÁMARA

const camera = new THREE.PerspectiveCamera(
  60,
  1,
  0.1,
  100
);

camera.position.set(5.2, 4.2, 9.2);
camera.lookAt(0, 0.7, 1.2);

// 7. RENDERIZADOR

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

renderer.xr.enabled = true;

container.appendChild(renderer.domElement);
placeholder?.remove();

// 8. CONTROLES DE ESCRITORIO

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.target.set(0, 0.7, 1.2);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.05;
controls.update();

// 9. AJUSTE DE PANTALLA

function resizeRenderer() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (!renderer.xr.isPresenting) {
    renderer.setSize(width, height, false);
  }
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(container);
resizeRenderer();

// 10. PANEL DE PUNTUACIÓN

const hud = createHUD(scene);

// MARCADOR EN ESCRITORIO

const scorePreview = document.createElement("div");
scorePreview.id = "score-preview";

Object.assign(scorePreview.style, {
  padding: "14px 20px",
  fontSize: "13px",
  lineHeight: "1.8",
  textAlign: "center"
});

container.insertAdjacentElement("afterend", scorePreview);

// 11. JUEGO

const game = createGame({
  pieces,
  containers,
  tables,
  world,
  onChange: renderScore
});

function formatTime(seconds) {
  if (seconds === null) return "Pendiente";

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  return (
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0")
  );
}

function renderScore() {
  const data = game.getState();

  hud.render(data);

  const categories = Object.entries(data.progress)
    .map(([id, count]) => {
      const category = CATEGORIES.find(c => c.id === id);

      return `${category?.name ?? id}: ${count}/5`;
    })
    .join(" | ");

  scorePreview.textContent =
    `Aciertos: ${data.correct}/20 | ` +
    `Errores: ${data.errors} | ` +
    `Intentos: ${data.attempts} | ` +
    `Precisión: ${data.precision.toFixed(1)}% | ` +
    `Tiempo: ${formatTime(data.elapsed)} | ` +
    categories + " | " + data.message;

  if (status) {
    status.textContent =
      data.status === "completado"
        ? "ACTIVIDAD COMPLETADA"
        : data.status === "jugando"
          ? "CLASIFICACIÓN EN CURSO"
          : "LABORATORIO PREPARADO";
  }

  updateVRButtonLabels();
}

// 12. BOTONES DE ESCRITORIO

const startButton = document.createElement("button");

startButton.id = "start-game";
startButton.type = "button";
startButton.textContent = "Comenzar clasificación";
startButton.className = "btn btn-primary-vr";

const controlBar = document.querySelector(".lab-controls");

controlBar?.prepend(startButton);

function startGame() {
  if (!game.start()) return false;

  startButton.disabled = true;
  startButton.textContent = "Partida iniciada";

  console.log("Partida iniciada");

  return true;
}

let interaction = null;

function resetGame() {
  interaction?.releaseAll();

  game.reset();

  startButton.disabled = false;
  startButton.textContent = "Comenzar clasificación";

  console.log("Laboratorio reiniciado");

  return true;
}

startButton.addEventListener("click", startGame);

if (resetButton) {
  resetButton.disabled = false;
  resetButton.addEventListener("click", resetGame);
}

// ============================================
// 13. INTERFAZ DE BOTONES EN REALIDAD VIRTUAL
// ============================================

// Este grupo contiene los botones.
// Su posición se ajustará al entrar en VR.

const vrControls = new THREE.Group();
vrControls.name = "Controles XR";
vrControls.userData.keepXRPosition = true;

scene.add(vrControls);

vrControls.visible = false;

let vrControlsPlaced = false;

// Crear botones con textura de Canvas.

function createVRButton(label, x, action, color) {
  const canvas = document.createElement("canvas");

  canvas.width = 512;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.28),
    material
  );

  mesh.position.set(x, 0, 0);

  mesh.renderOrder = 20;

  vrControls.add(mesh);

  const button = {
    mesh,
    canvas,
    ctx,
    texture,
    label,
    action,
    color,
    hovered: false
  };

  drawVRButton(button);

  return button;
}

function drawVRButton(button) {
  const { ctx, canvas } = button;

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Color de fondo.
  ctx.fillStyle = button.hovered
    ? "#e8eee9"
    : button.color;

  ctx.beginPath();
  ctx.roundRect(12, 12, 488, 232, 30);
  ctx.fill();

  ctx.lineWidth = 8;

  ctx.strokeStyle = button.hovered
    ? "#317f78"
    : "#ffffff";

  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "bold 55px Arial";

  ctx.fillStyle = button.hovered
    ? "#223044"
    : "#ffffff";

  ctx.fillText(
    button.label,
    256,
    128
  );

  button.texture.needsUpdate = true;
}

const vrStartButton = createVRButton(
  "COMENZAR",
  -0.38,
  startGame,
  "#317f78"
);

const vrResetButton = createVRButton(
  "REINICIAR",
  0.38,
  resetGame,
  "#b65c40"
);

const vrButtons = [
  vrStartButton,
  vrResetButton
];

function updateVRButtonLabels() {
  if (!vrStartButton || !vrResetButton) return;

  const state = game.getState();

  const label = state.status === "preparado"
    ? "COMENZAR"
    : state.status === "completado"
      ? "FINALIZADO"
      : "EN CURSO";

  if (vrStartButton.label !== label) {
    vrStartButton.label = label;
    drawVRButton(vrStartButton);
  }
}

// ============================================
// 14. POSICIONAMIENTO DE CONTROLES EN VR
// ============================================

// Al entrar, coloca los botones delante del
// usuario y ligeramente por debajo de su vista.

const headPosition = new THREE.Vector3();
const headDirection = new THREE.Vector3();

function positionVRControls() {
  if (!vrControls || vrControlsPlaced) return;

  // ESTACION DE CONTROL VR
  // El salon ya fue centrado en el origen.
  // Ubicacion lateral, separada de las mesas.
  const estacion = new THREE.Vector3(
    -2.65,
    1.35,
    -0.45
  );

  // Los botones deben pertenecer a la escena,
  // NO a la camara ni a las manos.
  if (vrControls.parent !== scene) {
    scene.attach(vrControls);
  }

  vrControls.position.copy(estacion);

  // Orientar el panel hacia el centro del aula.
  vrControls.lookAt(
    0,
    1.35,
    0
  );

  // Tamaño compacto para no estorbar.
  vrControls.scale.setScalar(0.78);

  vrControls.visible = true;
  vrControlsPlaced = true;

  vrControls.updateMatrixWorld(true);

  console.log(
    "NEXUS: estacion de control fija",
    {
      x: estacion.x,
      y: estacion.y,
      z: estacion.z
    }
  );
}

// ============================================
// 15. DETECCIÓN DE MANOS
// ============================================

const handStates = [
  {
    pinching: false,
    touching: null,
    touchDuration: 0,
    touchActivated: false
  },
  {
    pinching: false,
    touching: null,
    touchDuration: 0,
    touchActivated: false
  }
];

const fingerPosition = new THREE.Vector3();
const thumbPosition = new THREE.Vector3();
const pinchPosition = new THREE.Vector3();
const localPosition = new THREE.Vector3();

let lastButtonAction = -Infinity;
let elapsedInteractionTime = 0;

const BUTTON_COOLDOWN = 0.65;

function getJointWorldPosition(hand, jointName, target) {
  const joint = hand.joints?.[jointName];

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

// Comprobar si una posición está dentro
// del área interactiva de un botón.

function insideButton(
  button,
  worldPosition,
  marginZ = 0.16
) {
  localPosition.copy(worldPosition);

  button.mesh.worldToLocal(localPosition);

  return (
    Math.abs(localPosition.x) <= 0.34 &&
    Math.abs(localPosition.y) <= 0.16 &&
    Math.abs(localPosition.z) <= marginZ
  );
}

function activateVRButton(button) {
  if (
    elapsedInteractionTime - lastButtonAction <
    BUTTON_COOLDOWN
  ) {
    return;
  }

  if (
    button === vrStartButton &&
    game.getState().status !== "preparado"
  ) {
    return;
  }

  lastButtonAction = elapsedInteractionTime;

  button.action();

  console.log(
    "Botón VR activado:",
    button.label
  );
}

// ============================================
// 16. ACTUALIZACIÓN DE BOTONES CON MANOS
// ============================================

// Selección VR basada en eventos de mano/controlador y seguimiento continuo.
// Adaptación del patrón de input de interaccion-virtual-3-2:
// en lugar de un click del navegador se usan señales WebXR.
const BUTTON_TOUCH_HOLD = 0.55;
const BUTTON_HALF_WIDTH = 0.33;
const BUTTON_HALF_HEIGHT = 0.14;
const BUTTON_PROXIMITY = 0.28;
const vrButtonRaycaster = new THREE.Raycaster();
const vrButtonRayOrigin = new THREE.Vector3();
const vrButtonRayDirection = new THREE.Vector3();
const vrButtonQuaternion = new THREE.Quaternion();
const buttonMeshes = vrButtons.map(button => button.mesh);
const buttonByMesh = new Map(vrButtons.map(button => [button.mesh, button]));
const pendingXRPresses = [false, false];
const lastXRPress = [-Infinity, -Infinity];

function selectButtonNearPoint(position, allowance = BUTTON_PROXIMITY) {
  vrControls.updateWorldMatrix(true, true);
  let selected = null;
  let best = Infinity;
  for (const button of vrButtons) {
    const local = button.mesh.worldToLocal(position.clone());
    if (
      Math.abs(local.x) <= BUTTON_HALF_WIDTH + 0.10 &&
      Math.abs(local.y) <= BUTTON_HALF_HEIGHT + 0.10 &&
      Math.abs(local.z) <= allowance
    ) {
      const distance = Math.abs(local.z);
      if (distance < best) {
        selected = button;
        best = distance;
      }
    }
  }
  return selected;
}

function selectButtonFromRay(originObject) {
  if (!originObject) return null;
  originObject.updateWorldMatrix(true, false);
  originObject.getWorldPosition(vrButtonRayOrigin);
  originObject.getWorldQuaternion(vrButtonQuaternion);
  vrButtonRayDirection.set(0, 0, -1)
    .applyQuaternion(vrButtonQuaternion).normalize();
  vrButtonRaycaster.set(vrButtonRayOrigin, vrButtonRayDirection);
  vrButtonRaycaster.near = 0;
  vrButtonRaycaster.far = 2;
  vrControls.updateWorldMatrix(true, true);
  const hit = vrButtonRaycaster.intersectObjects(buttonMeshes, false)[0];
  return hit ? buttonByMesh.get(hit.object) : null;
}

function activateXRSelection(index, allowRay = true) {
  if (!renderer.xr.isPresenting || !vrControls.visible) return false;
  const hand = xr.hands[index];
  const indexJoint = hand?.joints?.["index-finger-tip"];
  const thumbJoint = hand?.joints?.["thumb-tip"];
  let selected = null;
  if (indexJoint?.visible) {
    indexJoint.getWorldPosition(fingerPosition);
    selected = selectButtonNearPoint(fingerPosition);
    if (!selected && thumbJoint?.visible) {
      thumbJoint.getWorldPosition(thumbPosition);
      const midpoint = fingerPosition.clone().add(thumbPosition).multiplyScalar(0.5);
      selected = selectButtonNearPoint(midpoint);
    }
  }
  // Alternativa para controles VR con rayos de selección.
  if (!selected && allowRay) {
    selected = selectButtonFromRay(renderer.xr.getController(index));
  }
  if (!selected) return false;
  activateVRButton(selected);
  console.log("NEXUS: selección XR", index, selected.label);
  return true;
}

function updateVRButtons(hands, delta) {
  if (!renderer.xr.isPresenting || !vrControls.visible) return;
  elapsedInteractionTime += delta;
  vrControls.updateWorldMatrix(true, true);

  const hoveredButtons = new Set();
  hands.forEach((hand, index) => {
    const state = handStates[index];
    hand.updateWorldMatrix(true, true);
    const indexOK = getJointWorldPosition(hand, "index-finger-tip", fingerPosition);
    const thumbOK = getJointWorldPosition(hand, "thumb-tip", thumbPosition);

    if (!indexOK) {
      state.pinching = false;
      state.touching = null;
      state.touchDuration = 0;
      state.touchActivated = false;
      return;
    }

    const pinchDistance = thumbOK
      ? fingerPosition.distanceTo(thumbPosition)
      : Infinity;
    const pinching = state.pinching
      ? pinchDistance < 0.075
      : pinchDistance < 0.050;

    const hoverTarget = selectButtonNearPoint(fingerPosition, 0.35);
    if (hoverTarget) hoveredButtons.add(hoverTarget);

    // Flanco de pinza: solo una activación por gesto.
    if (pinching && !state.pinching) {
      const selected = selectButtonNearPoint(fingerPosition, 0.30);
      if (selected) {
        activateVRButton(selected);
        state.touchActivated = true;
      }
    }

    // Contacto sostenido: útil cuando el emulador no emite pinchstart.
    const touching = selectButtonNearPoint(fingerPosition, 0.09);
    if (touching !== state.touching) {
      state.touching = touching;
      state.touchDuration = 0;
      state.touchActivated = false;
    }
    if (touching && !pinching) {
      state.touchDuration += delta;
      if (!state.touchActivated && state.touchDuration >= BUTTON_TOUCH_HOLD) {
        activateVRButton(touching);
        state.touchActivated = true;
      }
    }
    state.pinching = pinching;
  });

  // Eventos selectstart/pinchstart se procesan durante el frame, cuando
  // Three.js ya actualizó la matriz de la mano.
  for (let index = 0; index < pendingXRPresses.length; index++) {
    if (!pendingXRPresses[index]) continue;
    pendingXRPresses[index] = false;
    if (elapsedInteractionTime - lastXRPress[index] < 0.25) continue;
    lastXRPress[index] = elapsedInteractionTime;
    activateXRSelection(index);
  }

  for (const button of vrButtons) {
    const hovered = hoveredButtons.has(button);
    if (button.hovered !== hovered) {
      button.hovered = hovered;
      drawVRButton(button);
    }
  }
}

// ============================================
// 17. CONFIGURACIÓN WEBXR
// ============================================

const xr = setupXR({
  renderer,
  scene,
  button: startVRButton,
  statusElement: xrStatus,

  onSessionEnd: () => {
    interaction?.releaseAll();

    controls.enabled = true;

    vrControls.visible = false;
    vrControlsPlaced = false;

    for (const state of handStates) {
      state.pinching = false;
      state.touching = null;
      state.touchDuration = 0;
      state.touchActivated = false;
    }
  }
});

// Las manos son controladas por WebXR y nunca se mueven con el salón.
xr.hands.forEach(hand => { hand.userData.keepXRPosition = true; });

// Usar los eventos WebXR igual que el proyecto de referencia.
// No utilizamos click del DOM para activar los paneles tridimensionales.
xr.hands.forEach((hand, index) => {
  hand.addEventListener("pinchstart", () => {
    pendingXRPresses[index] = true;
  });
  hand.addEventListener("selectstart", () => {
    pendingXRPresses[index] = true;
  });
  renderer.xr.getController(index).addEventListener("selectstart", () => {
    pendingXRPresses[index] = true;
  });
});

// Prueba de teclado desde PC, sin tocar la sesión immersive-vr.
// No reemplaza el seguimiento de manos real.
window.addEventListener("keydown", event => {
  if (!renderer.xr.isPresenting || event.repeat) return;
  if (event.target?.matches?.("input,textarea,[contenteditable]")) return;
  if (event.code === "Digit1") {
    event.preventDefault();
    activateVRButton(vrStartButton);
  } else if (event.code === "Digit2") {
    event.preventDefault();
    activateVRButton(vrResetButton);
  }
});

// No desplazamos la cámara ni las manos: el mundo está centrado
// sobre el origen del visor XR. Esto evita el fallo de IWE con offsets.
const vrHeadPosition = new THREE.Vector3();
let spawnLogged = false;

window.NEXUS_XR_POSITION = () => {
  if (!renderer.xr.isPresenting) return { active: false };
  const tracked = renderer.xr.getCamera();
  tracked.updateWorldMatrix(true, false);
  tracked.getWorldPosition(vrHeadPosition);
  return {
    active: true,
    x: Number(vrHeadPosition.x.toFixed(3)),
    y: Number(vrHeadPosition.y.toFixed(3)),
    z: Number(vrHeadPosition.z.toFixed(3)),
    expected: [0, 1.6, 0],
    inside: Math.abs(vrHeadPosition.x) < 3.6 &&
      Math.abs(vrHeadPosition.z) < 4.1
  };
};

// INTERACCIÓN CON FIGURAS

interaction = createHandInteraction({
  hands: xr.hands,
  pieces,
  renderer
});

// ============================================
// 18. SIMULACIÓN FÍSICA
// ============================================

const clock = new THREE.Clock();

let accumulator = 0;

function updatePhysics(delta) {
  accumulator += delta;

  let steps = 0;

  while (
    accumulator >= FIXED_STEP &&
    steps < 4
  ) {
    world.step(FIXED_STEP);

    accumulator -= FIXED_STEP;
    steps++;

    game.update(FIXED_STEP);
  }

  if (
    steps === 4 &&
    accumulator >= FIXED_STEP
  ) {
    accumulator = 0;
  }

  syncPieces(pieces);
}

// ============================================
// 19. BUCLE PRINCIPAL
// ============================================

let displayAccumulator = 0;

function animate() {
  const delta = Math.min(
    clock.getDelta(),
    1 / 30
  );

  if (renderer.xr.isPresenting) {
    controls.enabled = false;

    // Reubicar el visor al terminar el primer render XR.
    // No se llama a setReferenceSpace mientras se procesan los dedos.

    // Mantener botones dentro del alcance de los dedos.
    // Al desplazarse no se quedan abandonados en otra zona del salon.
    if (window.CLASSROOM_LAYOUT?.model && !vrControlsPlaced) positionVRControls();

    // Primero procesar los botones.
    updateVRButtons(xr.hands, delta);

    // Después procesar figuras físicas.
    interaction.update(delta);

  } else {
    controls.enabled = true;
    controls.update();
  }

  updatePhysics(delta);

  displayAccumulator += delta;

  if (displayAccumulator >= 0.15) {
    displayAccumulator = 0;
    renderScore();
  }

  renderer.render(scene, camera);
  if (renderer.xr.isPresenting && !spawnLogged) {
    const pos = window.NEXUS_XR_POSITION();
    if (pos.active && pos.y > 0.3) {
      spawnLogged = true;
      console.log("NEXUS: posicion XR con rig", pos);
    }
  }

}

renderer.setAnimationLoop(animate);

// Integración de selección WebXR tomada del proyecto de referencia.
// Activa COMENZAR y REINICIAR, pero nunca finaliza la sesión.
installVRReferenceButtons({
  renderer,
  vrButtons,
  vrControls,
  startGame,
  resetGame,
  hands: xr.hands
});

// ============================================
// 20. EVENTOS WEBXR
// ============================================

renderer.xr.addEventListener(
  "sessionstart",
  () => {
    accumulator = 0;
    clock.getDelta();

    vrControlsPlaced = false;

    elapsedInteractionTime = 0;
    lastButtonAction = -Infinity;

    spawnLogged = false;
    vrControls.userData.initialPlacementLogged = false;
    // El salón ya está centrado sobre el origen del visor.

    console.log("Sesión WebXR iniciada");
  }
);

renderer.xr.addEventListener(
  "sessionend",
  () => {
    accumulator = 0;
    clock.getDelta();

    vrControls.visible = false;
    vrControlsPlaced = false;

    controls.update();

    console.warn("Sesion WebXR finalizada (evento del navegador/emulador).", {
      gameStatus: game.getState().status,
      // WebXR no expone un codigo estandar del motivo de salida.
      browserVisibility: document.visibilityState
    });
  }
);

// ============================================
// 21. HERRAMIENTAS DE DIAGNÓSTICO
// ============================================

function debugDrop(categoryId, containerId) {
  const piece = pieces.find(p =>
    p.category === categoryId &&
    p.state !== "clasificado" &&
    p.state !== "sujeto" &&
    !p._needsRecovery
  );

  const target = containers.find(
    c => c.id === containerId
  );

  if (!piece || !target) {
    console.warn(
      "Figura o recipiente no disponible"
    );
    return false;
  }

  if (game.getState().status !== "jugando") {
    console.warn(
      "Primero presiona Comenzar clasificación"
    );
    return false;
  }

  const body = piece.body;

  body.type = 1;
  body.mass = piece.originalMass ?? 0.35;

  body.updateMassProperties();

  body.position.set(
    target.position.x,
    target.interior.rimY + 0.35,
    target.position.z
  );

  body.quaternion.set(0, 0, 0, 1);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);

  body.aabbNeedsUpdate = true;
  body.wakeUp();

  piece.state = "liberado";

  piece._stableTime = 0;
  piece._wrongTime = 0;
  piece._wrongContainer = null;
  piece._errorRegistered = false;

  world.broadphase.dirty = true;

  console.log(
    `Prueba: ${categoryId} en ${containerId}`
  );

  return true;
}

// ============================================
// 22. ESTADÍSTICAS
// ============================================

const categoryCounts = Object.fromEntries(
  CATEGORIES.map(category => [
    category.id,
    pieces.filter(
      p => p.category === category.id
    ).length
  ])
);

const tableCounts = tables.map(
  (_, index) =>
    pieces.filter(
      p => p.tableIndex === index
    ).length
);

// ============================================
// 23. DEPURACIÓN
// ============================================

window.NEXUS_DEBUG = {
  scene,
  camera,
  renderer,
  world,
  tables,
  containers,
  pieces,
  staticBodies,
  categoryCounts,
  tableCounts,
  game,
  hud,
  xr,
  interaction,
  vrControls,
  vrButtons,
  startGame,
  resetGame,
  testInput: () => ({ pendingXRPresses: [...pendingXRPresses], states: handStates.map(s => ({pinching:s.pinching, touching:s.touching?.label || null})), presenting: renderer.xr.isPresenting }),
  debugVRButton: (which = "start") => {
    const target = which === "reset" ? vrResetButton : vrStartButton;
    activateVRButton(target);
    return game.getState();
  },
  debugDrop
};

// ============================================
// 24. VERIFICACIÓN INICIAL
// ============================================

console.log(
  "TALLER DE FORMAS - Laboratorio iniciado"
);

console.log("Three.js:", THREE.REVISION);
console.log("Mesas:", tables.length);
console.log("Figuras:", pieces.length);
console.log("Recipientes:", containers.length);
console.log("Cuerpos físicos:", world.bodies.length);

console.log(
  "Controles VR: contacto y pinza configurados"
);

renderScore();


// ============================================
// INTEGRACION DEL SALON SKETCHUP
// ============================================

integrateClassroom({
  scene,
  world,
  tables,
  pieces,
  containers,
  hud,
  camera,
  controls,
  renderer
}).then(() => {
  // Verificar que los objetos principales
  // se encuentran dentro del salon.
  const result = {
    mesas: tables.length,
    figuras: pieces.length,
    recipientes: containers.length,
    cuerpos: world.bodies.length,
    estado: "SALON CARGADO"
  };

  console.table(result);
}).catch(error => {
  console.error(
    "Error al integrar el salon:",
    error
  );
});



