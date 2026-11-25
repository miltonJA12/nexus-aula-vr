
/* ==========================================
   TALLER DE FORMAS
   Sistema de sonido con Web Audio API
   ========================================== */

let audioContext = null;
let muted = false;

const MASTER_VOLUME = 0.16;

function getContext() {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function tone({
  frequency = 440,
  endFrequency = frequency,
  duration = 0.15,
  delay = 0,
  wave = "sine",
  volume = 0.45
}) {
  if (muted) return;

  const ctx = getContext();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const end = start + duration;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = wave;

  oscillator.frequency.setValueAtTime(
    frequency,
    start
  );

  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(1, endFrequency),
    end
  );

  gain.gain.setValueAtTime(0.0001, start);

  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, MASTER_VOLUME * volume),
    start + 0.015
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    end
  );

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(start);
  oscillator.stop(end + 0.015);

  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

export function playStart() {
  tone({
    frequency: 392,
    endFrequency: 440,
    duration: 0.14,
    volume: 0.35
  });

  tone({
    frequency: 523.25,
    duration: 0.18,
    delay: 0.11,
    volume: 0.28
  });
}

export function playCorrect() {
  tone({
    frequency: 523.25,
    endFrequency: 587.33,
    duration: 0.12
  });

  tone({
    frequency: 783.99,
    duration: 0.23,
    delay: 0.1,
    volume: 0.38
  });
}

export function playError() {
  tone({
    frequency: 310,
    endFrequency: 245,
    duration: 0.22,
    wave: "triangle",
    volume: 0.36
  });
}

export function playReset() {
  tone({
    frequency: 500,
    endFrequency: 380,
    duration: 0.15,
    volume: 0.25
  });
}

export function playFinish() {
  const notes = [
    392,
    493.88,
    587.33,
    783.99
  ];

  notes.forEach((frequency, index) => {
    tone({
      frequency,
      duration: 0.30,
      delay: index * 0.13,
      volume: 0.35
    });
  });
}

export function setMuted(value) {
  muted = Boolean(value);
  updateButton();
}

export function isMuted() {
  return muted;
}

let toggleButton = null;

function updateButton() {
  if (!toggleButton) return;

  toggleButton.textContent = muted
    ? "Sonido desactivado"
    : "Sonido activado";

  toggleButton.setAttribute(
    "aria-pressed",
    String(muted)
  );

  toggleButton.setAttribute(
    "aria-label",
    muted
      ? "Activar sonidos del laboratorio"
      : "Silenciar sonidos del laboratorio"
  );
}

export function initAudioControls() {
  if (toggleButton) return;

  const toolbar = document.querySelector(
    ".lab-controls"
  );

  if (!toolbar) return;

  toggleButton = document.createElement("button");

  toggleButton.type = "button";
  toggleButton.className = "audio-toggle";

  toggleButton.addEventListener("click", () => {
    muted = !muted;

    if (!muted) {
      getContext();
    }

    updateButton();
  });

  toolbar.appendChild(toggleButton);

  updateButton();
}

// La interfaz se crea cuando se importa el
// módulo, después de que el HTML haya cargado.
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initAudioControls,
    { once: true }
  );
} else {
  initAudioControls();
}

