import * as THREE from "three";

import {
  XRHandModelFactory
} from "three/addons/webxr/XRHandModelFactory.js";

// =============================================
// NEXUS PHYSICS VR
// WebXR + Meta Quest 3 + Hand Tracking
// =============================================

export function setupXR({
  renderer,
  scene,
  button,
  statusElement,
  onSessionEnd = () => {}
}) {
  const hands = [];
  const handFactory = new XRHandModelFactory();

  let supported = false;
  let starting = false;
  let activeSession = null;

  // ===========================================
  // 1. CONFIGURAR EL RENDERIZADOR WEBXR
  // ===========================================

  renderer.xr.enabled = true;

  renderer.xr.setReferenceSpaceType("local-floor");

  // ===========================================
  // 2. CREAR AMBAS MANOS
  // ===========================================

  for (let index = 0; index < 2; index++) {
    const hand = renderer.xr.getHand(index);

    const handModel = handFactory.createHandModel(
      hand,
      "mesh"
    );

        hand.add(handModel);

    // NEXUS_HAND_POINTER_V2
    const pointer = createNexusHandPointer(
      index === 0 ? 0x28d9ff : 0x55e6ac
    );

    // Colocarlo sobre la punta del indice.
    const fingerTip = hand.joints?.["index-finger-tip"];

    if (fingerTip) {
      fingerTip.add(pointer);
    } else {
      hand.add(pointer);
    }

    scene.add(hand);

    hands.push(hand);
  }

  function setStatus(message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function setButton(label, disabled) {
    if (!button) return;

    button.textContent = label;
    button.disabled = disabled;
  }

  // ===========================================
  // 3. COMPROBAR SOPORTE WEBXR
  // ===========================================

  async function checkSupport() {
    if (!window.isSecureContext) {
      setStatus(
        "WebXR requiere HTTPS o localhost seguro."
      );
      setButton("VR no disponible", true);
      return;
    }

    if (!navigator.xr) {
      setStatus(
        "Este navegador no proporciona WebXR immersive-vr."
      );
      setButton("VR no disponible", true);
      return;
    }

    try {
      supported = await navigator.xr.isSessionSupported(
        "immersive-vr"
      );

      if (supported) {
        setButton("Iniciar realidad virtual", false);

        setStatus(
          "WebXR disponible. Activa el seguimiento de manos en tu visor."
        );
      } else {
        setStatus(
          "Modo escritorio: vista previa no inmersiva."
        );

        setButton("VR no disponible", true);
      }
    } catch (error) {
      console.error(
        "Error comprobando WebXR:",
        error
      );

      setStatus(
        "No fue posible comprobar la compatibilidad VR."
      );
      setButton("VR no disponible", true);
    }
  }

  // ===========================================
  // 4. INICIAR SESIÓN INMERSIVA
  // ===========================================

  async function startSession() {
    if (
      !supported ||
      starting ||
      renderer.xr.isPresenting
    ) {
      return;
    }

    starting = true;
    setButton("Conectando Meta Quest...", true);

    try {
      // El navegador puede solicitar permisos.
      // Hand tracking se solicita como función
      // opcional, pero será necesario para jugar.
      const session = await navigator.xr.requestSession(
        "immersive-vr",
        {
          requiredFeatures: ["local-floor"],
          optionalFeatures: ["hand-tracking"]
        }
      );

      activeSession = session;

      await renderer.xr.setSession(session);

      setButton("Realidad virtual activa", true);

      setStatus(
        "Sesión VR activa. Usa tus manos para tomar las figuras."
      );

      console.log(
        "NEXUS VR: sesión immersive-vr iniciada"
      );
    } catch (error) {
      console.error(
        "No se pudo iniciar WebXR:",
        error
      );

      setButton(
        "Iniciar realidad virtual",
        !supported
      );

      setStatus(
        "Error al iniciar VR. Revisa permisos, HTTPS y compatibilidad."
      );
    } finally {
      starting = false;
    }
  }

  // ===========================================
  // 5. SALIR DE REALIDAD VIRTUAL
  // ===========================================

  async function endSession() {
    const session =
      activeSession || renderer.xr.getSession();

    if (!session) return;

    try {
      await session.end();
    } catch (error) {
      console.error(
        "Error al finalizar VR:",
        error
      );
    }
  }

  renderer.xr.addEventListener(
    "sessionend",
    () => {
      activeSession = null;

      setButton(
        "Iniciar realidad virtual",
        !supported
      );

      setStatus(
        "Sesión VR finalizada. Vista previa de escritorio."
      );

      onSessionEnd();

      console.log(
        "NEXUS VR: sesión finalizada"
      );
    }
  );

  renderer.xr.addEventListener(
    "sessionstart",
    () => {
      console.log(
        "NEXUS VR: WebXR conectado"
      );
    }
  );

  // ===========================================
  // 6. BOTÓN DE LA PORTADA
  // ===========================================

  if (button) {
    // VR_PROTECCION_CLIC
    // Un clic del navegador nunca finaliza WebXR.
    button.addEventListener("click", (event) => {
      if (renderer.xr.isPresenting) {
        event.preventDefault();
        event.stopPropagation();

        console.log(
          "NEXUS: clic HTML ignorado durante VR"
        );

        return;
      }

      startSession();
    });
  }

  checkSupport();

  return {
    hands,
    startSession,
    endSession,
    isPresenting: () => renderer.xr.isPresenting,
    isSupported: () => supported
  };
}


// ============================================
// NEXUS_HAND_POINTER_V2
// Punteros visuales para ambas manos
// ============================================

function createNexusHandPointer(color) {
  const group = new THREE.Group();

  group.name = "NEXUS_HAND_POINTER_V2";

  const length = 0.65;

  const geometry = new THREE.BufferGeometry()
    .setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -length)
    ]);

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    depthTest: false
  });

  const ray = new THREE.Line(geometry, material);
  ray.renderOrder = 100;
  group.add(ray);

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 12, 12),
    new THREE.MeshBasicMaterial({
      color,
      depthTest: false
    })
  );

  tip.position.z = -length;
  tip.renderOrder = 101;

  group.add(tip);

  return group;
}