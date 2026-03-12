import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import {
  DEFAULT_TICK_MS,
  DEPTH_SIZE,
  FOOD_TYPES,
  GRID_SIZE,
  createInitialState,
  pickNearestFood,
  queueDirection,
  resolveViewRelativeDirection,
  startGame,
  stepGame,
  togglePause,
} from "./gameLogic.js";

const board = document.querySelector("#game-board");
const scoreElement = document.querySelector("#score");
const shieldElement = document.querySelector("#shield-count");
const layerElement = document.querySelector("#layer-indicator");
const foodCountElement = document.querySelector("#food-count");
const statusElement = document.querySelector("#status");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const controlButtons = document.querySelectorAll("[data-direction]");

const keyToDirection = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  a: "left",
  A: "left",
  s: "down",
  S: "down",
  d: "right",
  D: "right",
  q: "ascend",
  Q: "ascend",
  e: "descend",
  E: "descend",
};

const foodPalette = {
  [FOOD_TYPES.normal.type]: 0xff7d67,
  [FOOD_TYPES.shield.type]: 0x6fd3ff,
  [FOOD_TYPES.double.type]: 0xffd166,
  [FOOD_TYPES.haste.type]: 0x79f2a3,
};

let state = createInitialState();
let stepTimer = null;
const absoluteDirections = new Set(["ascend", "descend"]);

const cubeHalf = (GRID_SIZE - 1) / 2;
const cubeWorldSize = GRID_SIZE + 1;
const guideDivisions = 20;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
board.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x08101d, 150, 360);

const camera = new THREE.PerspectiveCamera(78, 1, 0.1, 640);
const cameraTarget = new THREE.Vector3();

const ambientLight = new THREE.AmbientLight(0xcfe0ff, 1.75);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.55);
directionalLight.position.set(65, 92, 55);
scene.add(directionalLight);

const fillLight = new THREE.PointLight(0x79f2a3, 1.25, 280);
fillLight.position.set(-52, 38, -58);
scene.add(fillLight);

const arena = new THREE.Group();
scene.add(arena);

const snakeGroup = new THREE.Group();
const foodGroup = new THREE.Group();
const effectGroup = new THREE.Group();
arena.add(snakeGroup);
arena.add(foodGroup);
arena.add(effectGroup);

function applyGridOpacity(grid, opacity) {
  if (Array.isArray(grid.material)) {
    grid.material.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
    });
  } else {
    grid.material.transparent = true;
    grid.material.opacity = opacity;
  }
}

const cubeShell = new THREE.Mesh(
  new THREE.BoxGeometry(cubeWorldSize, cubeWorldSize, cubeWorldSize),
  new THREE.MeshBasicMaterial({
    color: 0x7aa6ff,
    transparent: true,
    opacity: 0.035,
    side: THREE.BackSide,
  }),
);
arena.add(cubeShell);

const cubeFrame = new THREE.LineSegments(
  new THREE.EdgesGeometry(
    new THREE.BoxGeometry(cubeWorldSize, cubeWorldSize, cubeWorldSize),
  ),
  new THREE.LineBasicMaterial({
    color: 0x7aa6ff,
    transparent: true,
    opacity: 0.2,
  }),
);
arena.add(cubeFrame);

const anchorSlices = [-cubeHalf, 0, cubeHalf];
anchorSlices.forEach((height, index) => {
  const grid = new THREE.GridHelper(
    cubeWorldSize,
    guideDivisions,
    index === 1 ? 0x4d79c6 : 0x27426f,
    0x1b3156,
  );
  grid.position.y = height;
  applyGridOpacity(grid, index === 1 ? 0.18 : 0.1);
  arena.add(grid);
});

const trackerGrid = new THREE.GridHelper(
  cubeWorldSize,
  guideDivisions,
  0x6fd3ff,
  0x2b5b99,
);
applyGridOpacity(trackerGrid, 0.26);
arena.add(trackerGrid);

const trackerColumn = new THREE.Mesh(
  new THREE.CylinderGeometry(0.07, 0.07, cubeWorldSize, 8),
  new THREE.MeshBasicMaterial({
    color: 0x6fd3ff,
    transparent: true,
    opacity: 0.14,
  }),
);
arena.add(trackerColumn);

const snakeGeometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
const foodGeometry = new THREE.IcosahedronGeometry(0.42, 1);
const foodHaloGeometry = new THREE.TorusGeometry(0.65, 0.05, 10, 24);
const shieldGeometry = new THREE.TorusGeometry(0.74, 0.06, 10, 28);
const beaconGeometry = new THREE.CylinderGeometry(0.11, 0.11, cubeWorldSize, 10);
const guideRingGeometry = new THREE.TorusGeometry(1, 0.04, 8, 28);

const snakeBodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x5de28f,
  emissive: 0x1d693b,
  roughness: 0.34,
  metalness: 0.16,
});

const snakeHeadMaterial = new THREE.MeshStandardMaterial({
  color: 0xd8ff9b,
  emissive: 0x577d16,
  roughness: 0.24,
  metalness: 0.22,
});

const foodCoreMaterials = Object.fromEntries(
  Object.entries(foodPalette).map(([type, color]) => [
    type,
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.24,
    }),
  ]),
);

const foodHaloMaterials = Object.fromEntries(
  Object.entries(foodPalette).map(([type, color]) => [
    type,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
    }),
  ]),
);

const shieldMaterial = new THREE.MeshBasicMaterial({
  color: 0x6fd3ff,
  transparent: true,
  opacity: 0.78,
});

const foodBeaconMaterials = Object.fromEntries(
  Object.entries(foodPalette).map(([type, color]) => [
    type,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15,
    }),
  ]),
);

const foodGuideMaterials = Object.fromEntries(
  Object.entries(foodPalette).map(([type, color]) => [
    type,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
    }),
  ]),
);

function gridToWorld(position) {
  return new THREE.Vector3(
    position.x - cubeHalf,
    position.z - cubeHalf,
    position.y - cubeHalf,
  );
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    group.remove(child);
  }
}

function worldVectorToThree(vector) {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function renderSnake() {
  clearGroup(snakeGroup);

  state.snake.forEach((segment, index) => {
    const mesh = new THREE.Mesh(
      snakeGeometry,
      index === 0 ? snakeHeadMaterial : snakeBodyMaterial,
    );
    mesh.position.copy(gridToWorld(segment));
    mesh.scale.setScalar(index === 0 ? 1.08 : 0.94);
    mesh.userData.segmentIndex = index;
    snakeGroup.add(mesh);
  });
}

function buildFoodCluster(food) {
  const cluster = new THREE.Group();

  const core = new THREE.Mesh(
    foodGeometry,
    foodCoreMaterials[food.type] ?? foodCoreMaterials.normal,
  );

  const halo = new THREE.Mesh(
    foodHaloGeometry,
    foodHaloMaterials[food.type] ?? foodHaloMaterials.normal,
  );

  halo.rotation.x = Math.PI / 2;
  cluster.position.copy(gridToWorld(food));
  cluster.userData.baseY = cluster.position.y;
  cluster.add(core);
  cluster.add(halo);
  return cluster;
}

function renderFoods() {
  clearGroup(foodGroup);
  state.foods.forEach((food) => {
    foodGroup.add(buildFoodCluster(food));
  });
}

function renderEffects() {
  clearGroup(effectGroup);
  const headWorld = gridToWorld(state.snake[0]);
  const nearestFood = pickNearestFood(state.snake[0], state.foods);

  if (state.shields > 0) {
    const ring = new THREE.Mesh(shieldGeometry, shieldMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(headWorld);
    ring.position.y += 0.15;
    effectGroup.add(ring);
  }

  if (nearestFood) {
    const foodWorld = gridToWorld(nearestFood);
    const beaconMaterial = foodBeaconMaterials[nearestFood.type] ?? foodBeaconMaterials.normal;
    const guideMaterial = foodGuideMaterials[nearestFood.type] ?? foodGuideMaterials.normal;

    const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beacon.position.set(foodWorld.x, 0, foodWorld.z);
    effectGroup.add(beacon);

    const foodRing = new THREE.Mesh(guideRingGeometry, guideMaterial);
    foodRing.rotation.x = Math.PI / 2;
    foodRing.position.copy(foodWorld);
    effectGroup.add(foodRing);

    const projectedRing = new THREE.Mesh(guideRingGeometry, guideMaterial);
    projectedRing.rotation.x = Math.PI / 2;
    projectedRing.position.set(foodWorld.x, headWorld.y, foodWorld.z);
    projectedRing.scale.setScalar(1.22);
    effectGroup.add(projectedRing);
  }
}

function getTickDelay() {
  return state.speedBoostTicks > 0 ? Math.max(90, DEFAULT_TICK_MS - 55) : DEFAULT_TICK_MS;
}

function updateHud() {
  const head = state.snake[0];
  const nearestFood = pickNearestFood(head, state.foods);

  scoreElement.textContent = String(state.score);
  shieldElement.textContent = String(state.shields);
  layerElement.textContent = `${head.z + 1} / ${state.depthSize}`;
  foodCountElement.textContent = String(state.foods.length);

  if (state.isGameOver) {
    statusElement.textContent = `Game over. Final score: ${state.score}. Press restart to continue the hunt.`;
    pauseButton.textContent = "Pause";
    return;
  }

  if (!state.hasStarted) {
    statusElement.textContent = `Cubic arena ${GRID_SIZE} x ${GRID_SIZE} x ${DEPTH_SIZE}. WASD/arrow keys follow head view, Q/E are absolute ascend/descend.`;
    pauseButton.textContent = "Pause";
    return;
  }

  if (state.isPaused) {
    statusElement.textContent = "Paused.";
    pauseButton.textContent = "Resume";
    return;
  }

  const nearestText = nearestFood
    ? `${nearestFood.label} | ${getLayerHint(head.z, nearestFood.z)}`
    : "No food visible";
  const shieldText = state.shields > 0 ? ` | Shield: ${state.shields}` : "";
  const hasteText = state.speedBoostTicks > 0 ? ` | Boost: ${state.speedBoostTicks}` : "";
  statusElement.textContent = `${nearestText} | Food: ${state.foods.length}${shieldText}${hasteText}`;
  pauseButton.textContent = "Pause";
}

function render() {
  renderSnake();
  renderFoods();
  renderEffects();
  updateHud();
}

function scheduleNextTick() {
  window.clearTimeout(stepTimer);
  stepTimer = window.setTimeout(() => {
    state = stepGame(state);
    render();
    scheduleNextTick();
  }, getTickDelay());
}

function restart() {
  state = createInitialState();
  render();
  snapCameraToHead();
  scheduleNextTick();
}

function handleDirectionInput(relativeDirection) {
  const worldDirection = absoluteDirections.has(relativeDirection)
    ? relativeDirection
    : resolveViewRelativeDirection(state.viewDirection, relativeDirection);
  const queuedDirection = queueDirection(state.direction, worldDirection);

  if (!state.hasStarted) {
    state = startGame(state, queuedDirection);
  } else {
    state = {
      ...state,
      queuedDirection,
    };
  }

  render();
  scheduleNextTick();
}

function computeCameraPose() {
  const headWorld = gridToWorld(state.snake[0]);
  const forward = worldVectorToThree(
    state.viewDirection === "up"
      ? { x: 0, y: 0, z: -1 }
      : state.viewDirection === "down"
        ? { x: 0, y: 0, z: 1 }
        : state.viewDirection === "left"
          ? { x: -1, y: 0, z: 0 }
          : { x: 1, y: 0, z: 0 },
  ).normalize();
  const shoulder = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const verticalBias = state.direction === "ascend" ? 2.2 : state.direction === "descend" ? -1.2 : 0;

  const desiredPosition = headWorld
    .clone()
    .add(up.clone().multiplyScalar(6.8))
    .add(shoulder.multiplyScalar(4.4))
    .add(forward.clone().multiplyScalar(-17.5));

  const desiredTarget = headWorld
    .clone()
    .add(up.clone().multiplyScalar(3.2 + verticalBias))
    .add(forward.clone().multiplyScalar(24));

  return { desiredPosition, desiredTarget, up };
}

function getLayerHint(headLayer, foodLayer) {
  const delta = foodLayer - headLayer;

  if (delta === 0) {
    return "same layer";
  }

  if (delta > 0) {
    return `${delta} layer${delta > 1 ? "s" : ""} above`;
  }

  const distance = Math.abs(delta);
  return `${distance} layer${distance > 1 ? "s" : ""} below`;
}

function snapCameraToHead() {
  const { desiredPosition, desiredTarget, up } = computeCameraPose();
  camera.position.copy(desiredPosition);
  cameraTarget.copy(desiredTarget);
  camera.up.copy(up);
  camera.lookAt(cameraTarget);
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = board;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function updateArenaGuides() {
  const headWorld = gridToWorld(state.snake[0]);
  trackerGrid.position.y = headWorld.y;
  trackerColumn.position.set(headWorld.x, 0, headWorld.z);
}

function animate() {
  const time = performance.now() * 0.001;

  snakeGroup.children.forEach((segment) => {
    segment.rotation.y = time * 0.42 + segment.userData.segmentIndex * 0.07;
  });

  foodGroup.children.forEach((cluster, index) => {
    cluster.rotation.y = time * 1.2 + index * 0.18;
    cluster.position.y = cluster.userData.baseY + 0.18 + Math.sin(time * 2.3 + index) * 0.12;
    cluster.children.forEach((child, childIndex) => {
      if (childIndex === 0) {
        child.rotation.x = time * 0.8;
        child.rotation.z = time * 1.1;
      } else {
        child.rotation.z = time * 1.7;
      }
    });
  });

  effectGroup.children.forEach((child) => {
    child.rotation.z = time * 2.1;
    child.scale.setScalar(1 + Math.sin(time * 3.2) * 0.05);
    child.position.copy(gridToWorld(state.snake[0]));
    child.position.y += 0.15;
  });

  updateArenaGuides();

  const { desiredPosition, desiredTarget, up } = computeCameraPose();
  camera.position.lerp(desiredPosition, 0.08);
  cameraTarget.lerp(desiredTarget, 0.14);
  camera.up.lerp(up, 0.12).normalize();
  camera.lookAt(cameraTarget);

  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

document.addEventListener("keydown", (event) => {
  const direction = keyToDirection[event.key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  handleDirectionInput(direction);
});

pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
  scheduleNextTick();
});

restartButton.addEventListener("click", restart);

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    const { direction } = button.dataset;
    if (direction) {
      handleDirectionInput(direction);
    }
  });
}

window.addEventListener("resize", resizeRenderer);

resizeRenderer();
render();
snapCameraToHead();
updateArenaGuides();
scheduleNextTick();
animate();
