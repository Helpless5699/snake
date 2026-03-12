# Classic Snake

A tiny zero-dependency Snake game built with HTML, CSS, and vanilla JavaScript.

## Run locally

From this folder, start a simple web server:

```powershell
python -m http.server 8000
```

Then open:

- `http://localhost:8000/` for the game
- `http://localhost:8000/tests/snake.test.html` for the logic tests

## Manual verification checklist

- Start the game with arrow keys or `WASD`
- Confirm the snake moves one cell per tick and cannot reverse into itself
- Eat food and verify the score increments and the snake grows
- Hit a wall or your own body and verify game-over appears
- Use `Pause` / `Resume` and confirm the snake stops moving while paused
- Use `Restart` and confirm the board resets to the initial state
- On a narrow/mobile viewport, confirm the on-screen direction buttons work
