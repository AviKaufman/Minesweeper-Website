# Minesweeper Website

A Vite + React recreation of the classic Minesweeper client (inspired by minesweeper.online) with:

- Preset and custom boards (safe first click, up to 30×30) and traditional visuals.
- Keyboard play with rebindable controls, flag mode toggle, and first-click-safe boards.
- Accurate game metrics (ms timer, 3BV tracking, 3BV/s, CPS, efficiency, estimated time) that can appear live or post-game either below or beside the board.
- Full mouse parity with desktop clients: press-and-hold reveals, chording, drag-to-press, and immediate right-click flagging.

## Getting Started

```bash
npm install
npm run dev   # start the dev server
npm run build # production build (outputs to dist/)
```

You’ll need Node 18+.

## Controls

| Action | Mouse | Keyboard (default) |
| --- | --- | --- |
| Reveal | Left-click release | `Enter` |
| Flag | Right-click (down) / Alt+left | `F` |
| Chord | Double-click or press on revealed number (all surrounding flags must be correct) | `C` |
| Toggle flag mode | Toolbar button | `Shift` |
| Move focus | — | Arrow keys |
| Restart board | Smiley button / `New board` | `Space` (`newBoard` bind) |

Keybinds live under *Settings → Controls*. The display section exposes cell size, focus highlighting, and metric placement options; theme and accent controls are also available.

## Project Structure

- `src/App.jsx` – game logic (board generation, input handling, metrics).
- `src/App.css` – bespoke styling to match classic desktop Minesweeper.
- `src/index.css` – global theme variables.
- `public/` – static assets (favicon, etc.).

The app uses functional components with React state hooks. Board state contains per-cell metadata (`isMine`, `neighborMines`, `threeBVGroup`, etc.), enabling instant redraws and accurate 3BV calculations.
