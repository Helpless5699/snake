export const GRID_SIZE = 80;
export const DEPTH_SIZE = GRID_SIZE;
export const ACTIVE_FOOD_COUNT = 64;
export const INITIAL_DIRECTION = "right";
export const INITIAL_UP_DIRECTION = "ascend";
export const DEFAULT_TICK_MS = 170;
export const FOOD_LAYER_ASSIST_RANGE = 1;

export const FOOD_TYPES = {
  normal: {
    type: "normal",
    label: "Normal",
    score: 1,
    growth: 1,
  },
  shield: {
    type: "shield",
    label: "Shield",
    score: 2,
    growth: 1,
    shield: 1,
  },
  double: {
    type: "double",
    label: "Double",
    score: 3,
    growth: 2,
  },
  haste: {
    type: "haste",
    label: "Haste",
    score: 2,
    growth: 1,
    speedBoostTicks: 10,
  },
};

const FOOD_BLUEPRINTS = Object.values(FOOD_TYPES);

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1, z: 0 },
  down: { x: 0, y: 1, z: 0 },
  left: { x: -1, y: 0, z: 0 },
  right: { x: 1, y: 0, z: 0 },
  ascend: { x: 0, y: 0, z: 1 },
  descend: { x: 0, y: 0, z: -1 },
};

const DIRECTION_TO_WORLD_VECTORS = {
  right: { x: 1, y: 0, z: 0 },
  left: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 0, z: -1 },
  down: { x: 0, y: 0, z: 1 },
  ascend: { x: 0, y: 1, z: 0 },
  descend: { x: 0, y: -1, z: 0 },
};

const OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
  ascend: "descend",
  descend: "ascend",
};

const HORIZONTAL_DIRECTIONS = new Set(["up", "down", "left", "right"]);

export function createInitialSnake() {
  const center = Math.floor(GRID_SIZE / 2);
  const middleLayer = Math.floor(DEPTH_SIZE / 2);
  return [
    { x: center, y: center, z: middleLayer },
    { x: center - 1, y: center, z: middleLayer },
    { x: center - 2, y: center, z: middleLayer },
  ];
}

export function isSamePosition(left, right) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

export function createInitialState(random = Math.random) {
  const snake = createInitialSnake();
  return {
    gridSize: GRID_SIZE,
    depthSize: DEPTH_SIZE,
    activeFoodCount: ACTIVE_FOOD_COUNT,
    snake,
    direction: INITIAL_DIRECTION,
    queuedDirection: INITIAL_DIRECTION,
    viewDirection: INITIAL_DIRECTION,
    orientationUp: INITIAL_UP_DIRECTION,
    foods: placeFoods(snake, GRID_SIZE, DEPTH_SIZE, ACTIVE_FOOD_COUNT, random),
    score: 0,
    pendingGrowth: 0,
    shields: 0,
    speedBoostTicks: 0,
    isGameOver: false,
    isPaused: true,
    hasStarted: false,
  };
}

export function queueDirection(currentDirection, nextDirection) {
  if (!DIRECTION_VECTORS[nextDirection]) {
    return currentDirection;
  }

  if (OPPOSITES[currentDirection] === nextDirection) {
    return currentDirection;
  }

  return nextDirection;
}

export function isHorizontalDirection(direction) {
  return HORIZONTAL_DIRECTIONS.has(direction);
}

export function getDirectionVector(direction) {
  return DIRECTION_VECTORS[direction] ?? DIRECTION_VECTORS[INITIAL_DIRECTION];
}

export function getWorldVector(direction) {
  return (
    DIRECTION_TO_WORLD_VECTORS[direction] ??
    DIRECTION_TO_WORLD_VECTORS[INITIAL_DIRECTION]
  );
}

function getDirectionFromWorldVector(vector) {
  return Object.entries(DIRECTION_TO_WORLD_VECTORS).find(([, candidate]) =>
    candidate.x === vector.x &&
    candidate.y === vector.y &&
    candidate.z === vector.z,
  )?.[0] ?? INITIAL_DIRECTION;
}

function negateWorldVector(vector) {
  return {
    x: -vector.x,
    y: -vector.y,
    z: -vector.z,
  };
}

function crossWorldVectors(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function isSameWorldVector(left, right) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

export function getOrientationBasis(
  direction,
  orientationUp = INITIAL_UP_DIRECTION,
) {
  const forward = getWorldVector(direction);
  const up = getWorldVector(orientationUp);
  const right = crossWorldVectors(forward, up);

  return { forward, right, up };
}

export function resolveRelativeDirection(
  direction,
  orientationUp = INITIAL_UP_DIRECTION,
  relativeDirection,
) {
  const basis = getOrientationBasis(direction, orientationUp);

  if (relativeDirection === "up") {
    return direction;
  }

  if (relativeDirection === "down") {
    return getDirectionFromWorldVector(negateWorldVector(basis.forward));
  }

  if (relativeDirection === "left") {
    return getDirectionFromWorldVector(negateWorldVector(basis.right));
  }

  if (relativeDirection === "right") {
    return getDirectionFromWorldVector(basis.right);
  }

  if (relativeDirection === "ascend") {
    return getDirectionFromWorldVector(basis.up);
  }

  if (relativeDirection === "descend") {
    return getDirectionFromWorldVector(negateWorldVector(basis.up));
  }

  return direction;
}

export function resolveViewRelativeDirection(viewDirection, relativeDirection) {
  if (relativeDirection === "up") {
    return viewDirection;
  }

  if (relativeDirection === "down") {
    return OPPOSITES[viewDirection] ?? viewDirection;
  }

  if (viewDirection === "up") {
    return relativeDirection === "left" ? "left" : "right";
  }

  if (viewDirection === "down") {
    return relativeDirection === "left" ? "right" : "left";
  }

  if (viewDirection === "left") {
    return relativeDirection === "left" ? "down" : "up";
  }

  if (viewDirection === "right") {
    return relativeDirection === "left" ? "up" : "down";
  }

  return viewDirection;
}

export function getNextOrientationUp(
  direction,
  orientationUp = INITIAL_UP_DIRECTION,
  nextDirection,
) {
  const basis = getOrientationBasis(direction, orientationUp);
  const nextVector = getWorldVector(nextDirection);

  if (isSameWorldVector(nextVector, basis.up)) {
    return getDirectionFromWorldVector(negateWorldVector(basis.forward));
  }

  if (isSameWorldVector(nextVector, negateWorldVector(basis.up))) {
    return getDirectionFromWorldVector(basis.forward);
  }

  return orientationUp;
}

export function getNextHead(head, direction) {
  const vector = getDirectionVector(direction);
  return {
    x: head.x + vector.x,
    y: head.y + vector.y,
    z: head.z + vector.z,
  };
}

export function isOutsideGrid(position, gridSize, depthSize) {
  return (
    position.x < 0 ||
    position.y < 0 ||
    position.z < 0 ||
    position.x >= gridSize ||
    position.y >= gridSize ||
    position.z >= depthSize
  );
}

export function isOnSnake(position, snake) {
  return snake.some((segment) => isSamePosition(segment, position));
}

function createFood(position, random = Math.random) {
  const roll = random();

  if (roll >= 0.86) {
    return { ...position, ...FOOD_TYPES.shield };
  }

  if (roll >= 0.66) {
    return { ...position, ...FOOD_TYPES.double };
  }

  if (roll >= 0.48) {
    return { ...position, ...FOOD_TYPES.haste };
  }

  return { ...position, ...FOOD_TYPES.normal };
}

function buildOccupiedKeySet(snake, foods = []) {
  const keys = new Set();

  snake.forEach((segment) => {
    keys.add(getPositionKey(segment));
  });

  foods.forEach((food) => {
    keys.add(getPositionKey(food));
  });

  return keys;
}

function getPositionKey(position) {
  return `${position.x}:${position.y}:${position.z}`;
}

function createRandomPosition(gridSize, depthSize, random = Math.random) {
  return {
    x: Math.floor(random() * gridSize),
    y: Math.floor(random() * gridSize),
    z: Math.floor(random() * depthSize),
  };
}

function findRandomOpenPosition(
  occupiedKeys,
  gridSize,
  depthSize,
  random = Math.random,
  maxAttempts = 96,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = createRandomPosition(gridSize, depthSize, random);
    if (!occupiedKeys.has(getPositionKey(candidate))) {
      return candidate;
    }
  }

  return null;
}

function scanForOpenPosition(occupiedKeys, gridSize, depthSize) {
  for (let z = 0; z < depthSize; z += 1) {
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const candidate = { x, y, z };
        if (!occupiedKeys.has(getPositionKey(candidate))) {
          return candidate;
        }
      }
    }
  }

  return null;
}

export function placeFoods(
  snake,
  gridSize,
  depthSize,
  count,
  random = Math.random,
  existingFoods = [],
) {
  const volume = gridSize * gridSize * depthSize;
  const maxFoodCount = Math.max(0, volume - snake.length);
  const targetCount = Math.min(count, maxFoodCount);
  const foods = [];
  const occupiedKeys = buildOccupiedKeySet(snake);

  existingFoods.forEach((food) => {
    if (foods.length >= targetCount) {
      return;
    }

    const key = getPositionKey(food);
    if (!occupiedKeys.has(key)) {
      foods.push({ ...food });
      occupiedKeys.add(key);
    }
  });

  while (foods.length < targetCount) {
    const position =
      findRandomOpenPosition(occupiedKeys, gridSize, depthSize, random) ??
      scanForOpenPosition(occupiedKeys, gridSize, depthSize);

    if (!position) {
      break;
    }

    const food = createFood(position, random);
    foods.push(food);
    occupiedKeys.add(getPositionKey(position));
  }

  return foods;
}

export function getFoodAtPosition(position, foods) {
  return foods.find((food) => isSamePosition(food, position)) ?? null;
}

export function getConsumableFood(position, foods) {
  const exactFood = getFoodAtPosition(position, foods);
  if (exactFood) {
    return exactFood;
  }

  return foods
    .filter(
      (food) =>
        food.x === position.x &&
        food.y === position.y &&
        Math.abs(food.z - position.z) <= FOOD_LAYER_ASSIST_RANGE,
    )
    .sort((left, right) => Math.abs(left.z - position.z) - Math.abs(right.z - position.z))[0] ?? null;
}

export function stepGame(state, random = Math.random) {
  if (state.isGameOver || state.isPaused) {
    return state;
  }

  const direction = state.queuedDirection;
  const nextHead = getNextHead(state.snake[0], direction);
  const eatenFood = getConsumableFood(nextHead, state.foods);
  const collisionBody = eatenFood ? state.snake : state.snake.slice(0, -1);

  const hitBoundary = isOutsideGrid(nextHead, state.gridSize, state.depthSize);
  const hitBody = isOnSnake(nextHead, collisionBody);

  if (hitBoundary || hitBody) {
    if (hitBoundary && state.shields > 0) {
      return {
        ...state,
        shields: state.shields - 1,
        direction,
        queuedDirection: direction,
        viewDirection: state.viewDirection,
      };
    }

    return {
      ...state,
      direction,
      isGameOver: true,
      isPaused: true,
    };
  }

  const nextSnake = [nextHead, ...state.snake];
  let nextPendingGrowth = Math.max(0, state.pendingGrowth - 1);
  let nextScore = state.score;
  let nextShields = state.shields;
  let nextSpeedBoostTicks = Math.max(0, state.speedBoostTicks - 1);
  let nextFoods = state.foods;

  if (eatenFood) {
    nextScore += eatenFood.score;
    nextPendingGrowth += eatenFood.growth;
    nextShields += eatenFood.shield ?? 0;
    nextSpeedBoostTicks = Math.max(
      nextSpeedBoostTicks,
      eatenFood.speedBoostTicks ?? 0,
    );

    const remainingFoods = state.foods.filter(
      (food) => !isSamePosition(food, eatenFood),
    );

    nextFoods = placeFoods(
      nextSnake,
      state.gridSize,
      state.depthSize,
      state.activeFoodCount,
      random,
      remainingFoods,
    );
  }

  if (nextPendingGrowth > 0) {
    nextPendingGrowth -= 1;
  } else {
    nextSnake.pop();
  }

  return {
    ...state,
    snake: nextSnake,
    direction,
    viewDirection: isHorizontalDirection(direction)
      ? direction
      : state.viewDirection,
    orientationUp: getNextOrientationUp(
      state.direction,
      state.orientationUp,
      direction,
    ),
    queuedDirection: direction,
    foods: nextFoods,
    pendingGrowth: nextPendingGrowth,
    score: nextScore,
    shields: nextShields,
    speedBoostTicks: nextSpeedBoostTicks,
  };
}

export function startGame(state, nextDirection = state.direction) {
  return {
    ...state,
    direction: nextDirection,
    queuedDirection: nextDirection,
    viewDirection: isHorizontalDirection(nextDirection)
      ? nextDirection
      : state.viewDirection,
    orientationUp: getNextOrientationUp(
      state.direction,
      state.orientationUp,
      nextDirection,
    ),
    isPaused: false,
    hasStarted: true,
  };
}

export function togglePause(state) {
  if (state.isGameOver || !state.hasStarted) {
    return state;
  }

  return {
    ...state,
    isPaused: !state.isPaused,
  };
}

export function pickNearestFood(head, foods) {
  if (foods.length === 0) {
    return null;
  }

  return foods.reduce((closest, food) => {
    if (!closest) {
      return food;
    }

    const closestDistance =
      Math.abs(closest.x - head.x) +
      Math.abs(closest.y - head.y) +
      Math.abs(closest.z - head.z);
    const foodDistance =
      Math.abs(food.x - head.x) +
      Math.abs(food.y - head.y) +
      Math.abs(food.z - head.z);

    return foodDistance < closestDistance ? food : closest;
  }, null);
}

export function getFoodBlueprint(type) {
  return FOOD_BLUEPRINTS.find((food) => food.type === type) ?? FOOD_TYPES.normal;
}
