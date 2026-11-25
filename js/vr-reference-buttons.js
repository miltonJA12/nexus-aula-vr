import * as THREE from 'three';

// Botones XR basados en el patrón de selección del proyecto de referencia.
// No contiene llamadas a XRSession.end() ni eventos DOM click.
export function installVRReferenceButtons({ renderer, vrButtons, vrControls, startGame, resetGame, hands }) {
  const ray = new THREE.Raycaster();
  ray.near = 0;
  ray.far = 2.5;
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  let lastAction = -Infinity;
  let lastName = '';

  function invoke(button, method) {
    if (!button || !renderer.xr.isPresenting) return false;
    const action = button.action;
    if (action !== startGame && action !== resetGame) return false;
    const now = performance.now();
    if (now - lastAction < 500) return false;
    lastAction = now;
    lastName = action === startGame ? 'COMENZAR' : 'REINICIAR';
    const result = action();
    console.log('NEXUS: botón VR seleccionado', { button: lastName, method, result });
    return true;
  }

  function nearFinger(hand) {
    const tip = hand?.joints?.['index-finger-tip'];
    const thumb = hand?.joints?.['thumb-tip'];
    if (!tip?.visible) return null;
    tip.updateWorldMatrix(true, false);
    tip.getWorldPosition(pos);
    if (thumb?.visible) {
      const thumbPos = new THREE.Vector3();
      thumb.getWorldPosition(thumbPos);
      pos.add(thumbPos).multiplyScalar(0.5);
    }
    let chosen = null;
    let distance = Infinity;
    for (const button of vrButtons) {
      button.mesh.updateWorldMatrix(true, false);
      const p = button.mesh.worldToLocal(pos.clone());
      if (Math.abs(p.x) < .41 && Math.abs(p.y) < .23 && Math.abs(p.z) < .35) {
        if (Math.abs(p.z) < distance) {
          distance = Math.abs(p.z);
          chosen = button;
        }
      }
    }
    return chosen;
  }

  function rayHit(controller) {
    controller.updateWorldMatrix(true, false);
    controller.getWorldPosition(pos);
    controller.getWorldQuaternion(quat);
    dir.set(0, 0, -1).applyQuaternion(quat).normalize();
    ray.set(pos, dir);
    vrControls.updateWorldMatrix(true, true);
    const intersection = ray.intersectObjects(vrButtons.map(b => b.mesh), false)[0];
    return intersection ? vrButtons.find(b => b.mesh === intersection.object) : null;
  }

  [0, 1].forEach(index => {
    const controller = renderer.xr.getController(index);
    const hand = hands[index];
    // La detección se hace cuando el navegador reporta la selección,
    // nunca con click del mouse sobre el canvas.
    controller.addEventListener('selectstart', () => {
      if (!renderer.xr.isPresenting) return;
      invoke(nearFinger(hand) || rayHit(controller), 'selectstart');
    });
    hand.addEventListener('pinchstart', () => {
      if (!renderer.xr.isPresenting) return;
      invoke(nearFinger(hand) || rayHit(controller), 'pinchstart');
    });
  });

  // Ruta de prueba alternativa para IWE en laptop.
  window.addEventListener('keydown', event => {
    if (!renderer.xr.isPresenting || event.repeat || event.altKey || event.ctrlKey) return;
    if (event.code === 'Digit1' || event.code === 'Numpad1') {
      invoke(vrButtons.find(b => b.action === startGame), 'teclado 1');
    }
    if (event.code === 'Digit2' || event.code === 'Numpad2') {
      invoke(vrButtons.find(b => b.action === resetGame), 'teclado 2');
    }
  });

  renderer.xr.addEventListener('sessionend', () => {
    console.warn('NEXUS: WebXR finalizado (esta integración no ejecuta session.end)');
  });

  window.NEXUS_REFERENCE_BUTTONS = {
    testStart() { return invoke(vrButtons.find(b => b.action === startGame), 'consola'); },
    testReset() { return invoke(vrButtons.find(b => b.action === resetGame), 'consola'); },
    getState() { return { presenting: renderer.xr.isPresenting, lastAction: lastName }; }
  };
}
