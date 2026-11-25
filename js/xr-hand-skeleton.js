import * as THREE from "three";

// NEXUS_HAND_SKELETON_V13
// Esqueleto con huesos y articulaciones WebXR.

const CHAINS = [
  [
    "wrist",
    "thumb-metacarpal",
    "thumb-phalanx-proximal",
    "thumb-phalanx-distal",
    "thumb-tip"
  ],
  [
    "wrist",
    "index-finger-metacarpal",
    "index-finger-phalanx-proximal",
    "index-finger-phalanx-intermediate",
    "index-finger-phalanx-distal",
    "index-finger-tip"
  ],
  [
    "wrist",
    "middle-finger-metacarpal",
    "middle-finger-phalanx-proximal",
    "middle-finger-phalanx-intermediate",
    "middle-finger-phalanx-distal",
    "middle-finger-tip"
  ],
  [
    "wrist",
    "ring-finger-metacarpal",
    "ring-finger-phalanx-proximal",
    "ring-finger-phalanx-intermediate",
    "ring-finger-phalanx-distal",
    "ring-finger-tip"
  ],
  [
    "wrist",
    "pinky-finger-metacarpal",
    "pinky-finger-phalanx-proximal",
    "pinky-finger-phalanx-intermediate",
    "pinky-finger-phalanx-distal",
    "pinky-finger-tip"
  ]
];

const JOINTS = [...new Set(CHAINS.flat())];

const BONES = CHAINS.flatMap(chain =>
  chain.slice(1).map((joint, index) => [
    chain[index],
    joint
  ])
);

export function createXRHandSkeletons({
  scene,
  hands,
  renderer
}) {
  const temp = new THREE.Vector3();
  const middle = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();

  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  const skeletons = hands.map((hand, index) => {
    const color = index === 0
      ? 0x52d9ff
      : 0xa68cff;

    const root = new THREE.Group();

    root.name = "NEXUS_HAND_SKELETON_V13";
    root.userData.keepXRPosition = true;
    root.visible = false;

    scene.add(root);

    // Articulaciones luminosas.
    const joints = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.007, 8, 6),
      new THREE.MeshBasicMaterial({
        color,
        depthTest: false
      }),
      JOINTS.length
    );

    joints.frustumCulled = false;
    joints.renderOrder = 115;
    root.add(joints);

    // Huesos conectando articulaciones.
    const bones = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(
        0.003,
        0.003,
        1,
        6
      ),
      new THREE.MeshBasicMaterial({
        color,
        depthTest: false
      }),
      BONES.length
    );

    bones.frustumCulled = false;
    bones.renderOrder = 114;
    root.add(bones);

    return {
      hand,
      root,
      joints,
      bones
    };
  });

  function update() {
    const active = renderer.xr.isPresenting;

    for (const skeleton of skeletons) {
      if (!active) {
        skeleton.root.visible = false;
        continue;
      }

      const positions = new Map();

      // Leer las articulaciones medidas por WebXR.
      for (const name of JOINTS) {
        const joint = skeleton.hand.joints?.[name];

        if (!joint) continue;

        joint.updateWorldMatrix(true, false);
        joint.getWorldPosition(temp);

        if (
          Number.isFinite(temp.x) &&
          Number.isFinite(temp.y) &&
          Number.isFinite(temp.z)
        ) {
          positions.set(name, temp.clone());
        }
      }

      const wrist = positions.get("wrist");
      const indexTip = positions.get(
        "index-finger-tip"
      );

      // Ocultar si no hay una pose coherente.
      if (
        !wrist ||
        !indexTip ||
        wrist.distanceTo(indexTip) < 0.03 ||
        wrist.distanceTo(indexTip) > 0.40
      ) {
        skeleton.root.visible = false;
        continue;
      }

      skeleton.root.visible = true;

      // Actualizar articulaciones.
      JOINTS.forEach((name, i) => {
        const point = positions.get(name);

        if (!point) {
          skeleton.joints.setMatrixAt(i, hidden);
          return;
        }

        matrix.makeTranslation(
          point.x,
          point.y,
          point.z
        );

        skeleton.joints.setMatrixAt(i, matrix);
      });

      skeleton.joints.instanceMatrix.needsUpdate = true;

      // Actualizar huesos.
      BONES.forEach(([from, to], i) => {
        const a = positions.get(from);
        const b = positions.get(to);

        if (!a || !b) {
          skeleton.bones.setMatrixAt(i, hidden);
          return;
        }

        direction.subVectors(b, a);

        const length = direction.length();

        if (length < 0.001) {
          skeleton.bones.setMatrixAt(i, hidden);
          return;
        }

        quaternion.setFromUnitVectors(
          up,
          direction.normalize()
        );

        middle.copy(a).add(b).multiplyScalar(0.5);

        scale.set(1, length, 1);

        matrix.compose(
          middle,
          quaternion,
          scale
        );

        skeleton.bones.setMatrixAt(i, matrix);
      });

      skeleton.bones.instanceMatrix.needsUpdate = true;
    }
  }

  console.log("NEXUS: esqueletos XR preparados");

  return { update };
}