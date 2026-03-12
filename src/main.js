import {
  DEFAULT_TICK_MS,
  GRID_SIZE,
  createInitialState,
  queueDirection,
  startGame,
  stepGame,
  togglePause,
} from "./gameLogic.js";

const board = document.querySelector("#game-board");
const scoreElement = document.querySelector("#score");
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
};

let state = createInitialState();
let cells = [];

function buildBoard() {
  board.style.gridTemplateColumns = `repeat(${GRID_SIZE}, minmax(0, 1fr))`;
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < GRID_SIZE * GRID_SIZE; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    fragment.appendChild(cell);
    cells.push(cell);
  }

  board.appendChild(fragment);
}

function getCellIndex(position) {
  return position.y * GRID_SIZE + position.x;
}

function render() {
  for (const cell of cells) {
    cell.className = "cell";
  }

  state.snake.forEach((segment, index) => {
    const cell = cells[getCellIndex(segment)];
    if (!cell) {
      return;
    }

    cell.classList.add("snake");
    if (index === 0) {
      cell.classList.add("head");
    }
  });

  if (state.food) {
    const foodCell = cells[getCellIndex(state.food)];
    if (foodCell) {
      foodCell.classList.add("food");
    }
  }

  scoreElement.textContent = String(state.score);

  if (state.isGameOver) {
    statusElement.textContent = `Game over. Final score: ${state.score}. Press restart to play again.`;
    pauseButton.textContent = "Pause";
  } else if (!state.hasStarted) {
    statusElement.textContent = "Press any arrow key or WASD to start.";
    pauseButton.textContent = "Pause";
  } else if (state.isPaused) {
    statusElement.textContent = "Paused.";
    pauseButton.textContent = "Resume";
  } else {
    statusElement.textContent = "Collect food and avoid the walls or yourself.";
    pauseButton.textContent = "Pause";
  }
}

function restart() {
  state = createInitialState();
  render();
}

function handleDirectionInput(direction) {
  const queuedDirection = queueDirection(state.direction, direction);

  if (!state.hasStarted) {
    state = startGame(state, queuedDirection);
  } else {
    state = {
      ...state,
      queuedDirection,
    };
  }

  render();
}

function tick() {
  state = stepGame(state);
  render();
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

buildBoard();
render();
window.setInterval(tick, DEFAULT_TICK_MS);
