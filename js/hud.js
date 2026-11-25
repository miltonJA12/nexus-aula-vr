
import * as THREE from "three";

// =============================================
// NEXUS PHYSICS VR - PRÁCTICA 3.2
// PANEL DE PUNTUACIÓN INMERSIVO
// =============================================

export function createHUD(scene) {
  const canvas = document.createElement("canvas");

  canvas.width = 1024;
  canvas.height = 768;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No se pudo crear el Canvas del HUD.");
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.FrontSide,
    transparent: false,
    depthTest: true,
    depthWrite: true
  });

  // Panel más pequeño para no tapar las mesas.
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.24),
    material
  );

  // Ubicado detrás de las mesas, por encima
  // de la zona de manipulación de las figuras.
  board.position.set(0, 2.45, -3.5);

  // El frente mira hacia el eje Z positivo.
  board.rotation.set(0, 0, 0);

  board.renderOrder = 0;
  scene.add(board);

  const categories = [
    { id: "esfera", name: "ESFERAS", color: "#38aaff" },
    { id: "cubo", name: "CUBOS", color: "#ff647b" },
    { id: "piramide", name: "PIRÁMIDES", color: "#ffd166" },
    { id: "prisma", name: "PRISMAS", color: "#55e6ac" }
  ];

  function formatTime(seconds) {
    if (seconds === null || seconds === undefined) {
      return "PENDIENTE";
    }

    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);

    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(remaining).padStart(2, "0")
    );
  }

  function drawText(
    value,
    x,
    y,
    size = 30,
    color = "#ffffff",
    align = "left"
  ) {
    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), x, y);
  }

  function roundedRect(x, y, w, h, radius, color) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function render(state) {
    ctx.clearRect(0, 0, 1024, 768);

    ctx.fillStyle = "#081323";
    ctx.fillRect(0, 0, 1024, 768);

    ctx.strokeStyle = "#38d9ff";
    ctx.lineWidth = 7;
    ctx.strokeRect(8, 8, 1008, 752);

    roundedRect(23, 22, 978, 93, 12, "#112b46");

    drawText(
      "NEXUS PHYSICS VR",
      48, 70, 43, "#38d9ff"
    );

    drawText(
      state.status.toUpperCase(),
      958, 70, 26, "#ffffff", "right"
    );

    // =========================================
    // MÉTRICAS PRINCIPALES
    // =========================================

    drawText("ACIERTOS", 55, 158, 26, "#9badc6");
    drawText(
      `${state.correct}/20`,
      55, 226, 64, "#ffffff"
    );

    drawText("ERRORES", 405, 158, 26, "#9badc6");
    drawText(
      state.errors,
      405, 226, 64, "#ff647b"
    );

    drawText("PRECISIÓN", 710, 158, 26, "#9badc6");
    drawText(
      `${state.precision.toFixed(1)}%`,
      710, 226, 48, "#55e6ac"
    );

    roundedRect(35, 275, 954, 72, 10, "#10243c");

    drawText(
      `INTENTOS: ${state.attempts}`,
      65, 311, 29
    );

    drawText(
      `TIEMPO: ${formatTime(state.elapsed)}`,
      600, 311, 29
    );

    // =========================================
    // CONTADORES INDIVIDUALES
    // =========================================

    drawText(
      "CATEGORÍA",
      55, 389, 25, "#9badc6"
    );

    drawText(
      "PROGRESO",
      495, 389, 25, "#9badc6"
    );

    drawText(
      "FINALIZACIÓN",
      735, 389, 25, "#9badc6"
    );

    let y = 446;

    categories.forEach(category => {
      const count = state.progress[category.id] ?? 0;
      const completion = state.completionTimes[category.id];

      drawText(
        category.name,
        55, y, 29, category.color
      );

      drawText(
        `${count}/5`,
        520, y, 29
      );

      drawText(
        formatTime(completion),
        745, y, 27, "#d6e8ff"
      );

      y += 55;
    });

    // =========================================
    // MENSAJE DEL JUEGO
    // =========================================

    roundedRect(26, 677, 972, 62, 10, "#12314c");

    drawText(
      (state.message || "").slice(0, 63),
      512,
      708,
      25,
      "#ffffff",
      "center"
    );

    texture.needsUpdate = true;
  }

  function dispose() {
    scene.remove(board);
    board.geometry.dispose();
    material.dispose();
    texture.dispose();
  }

  return {
    board,
    render,
    dispose,
    formatTime
  };
}
