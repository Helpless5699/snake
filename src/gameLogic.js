export const GRID_SIZE = 16;
export const INITIAL_DIRECTION = "right";
export const DEFAULT_TICK_MS = 140;

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function createInitialSnake() {
  const center = Math.floor(GRID_SIZE / 2);
  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

export function createInitialState(random = Math.random) {
  const snake = createInitialSnake();
  return {
    gridSize: GRID_SIZE,
    snake,
    direction: INITIAL_DIRECTION,
    queuedDirection: INITIAL_DIRECTION,
    food: placeFood(snake, GRID_SIZE, random),
    score: 0,
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

export function getNextHead(head, direction) {
  const vector = DIRECTION_VECTORS[direction];
  return { x: head.x + vector.x, y: head.y + vector.y };
}

export function isOutsideGrid(position, gridSize) {
  return (
    position.x < 0 ||
    position.y < 0 ||
    position.x >= gridSize ||
    position.y >= gridSize
  );
}

export function isOnSnake(position, snake) {
  return snake.some((segment) => segment.x === position.x && segment.y === position.y);
}

export function placeFood(snake, gridSize, random = Math.random) {
  const openCells = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const candidate = { x, y };
      if (!isOnSnake(candidate, snake)) {
        openCells.push(candidate);
      }
    }
  }

  if (openCells.length === 0) {
    return null;
  }

  const index = Math.floor(random() * openCells.length);
  return openCells[index];
}

export function stepGame(state, random = Math.random) {
  if (state.isGameOver || state.isPaused) {
    return state;
  }

  const direction = state.queuedDirection;
  const nextHead = getNextHead(state.snake[0], direction);
  const willEat =
    state.food &&
    nextHead.x === state.food.x &&
    nextHead.y === state.food.y;
  const collisionBody = willEat ? state.snake : state.snake.slice(0, -1);

  if (isOutsideGrid(nextHead, state.gridSize) || isOnSnake(nextHead, collisionBody)) {
    return {
      ...state,
      direction,
      isGameOver: true,
      isPaused: true,
    };
  }

  const nextSnake = [nextHead, ...state.snake];
  if (!willEat) {
    nextSnake.pop();
  }

  return {
    ...state,
    snake: nextSnake,
    direction,
    queuedDirection: direction,
    food: willEat ? placeFood(nextSnake, state.gridSize, random) : state.food,
    score: willEat ? state.score + 1 : state.score,
  };
}

export function startGame(state, nextDirection = state.direction) {
  return {
    ...state,
    direction: nextDirection,
    queuedDirection: nextDirection,
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
