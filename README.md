# 3D Chess Game - Dune Edition

## Description

A 3D chess game with GPU-accelerated graphics powered by **Babylon.js**. Pieces are styled after characters from the Dune universe:
- **White (Atreides):** Fremen
- **Black (Imperium):** Sardaukar

## Tech Stack

- **3D Engine:** Babylon.js 6.0+
- **Language:** TypeScript
- **Build Tool:** esbuild
- **Chess Logic:** chess.js
- **Physics:** Babylon.js Physics (Cannon.js)

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the dev server
npm run dev
```

## Project Structure

```
3DimensionalChess/
├── src/
│   ├── game-engine.ts       # Main game engine
│   ├── board-renderer.ts    # 3D board rendering
│   ├── piece-renderer.ts    # Piece rendering
│   ├── chess-engine.ts      # Chess logic
│   ├── input-handler.ts     # Input handling (clicks)
│   ├── main.ts              # Entry point
│   └── utils/
│       ├── types.ts         # TypeScript types
│       ├── constants.ts     # Game constants
│       └── helpers.ts       # Helper functions
├── assets/
│   ├── models/
│   │   ├── sardaukar.glb    # Sardaukar model (black)
│   │   └── fremen_of_dune.glb # Fremen model (white)
│   ├── textures/            # Textures (board)
│   └── sounds/              # Sound effects
├── index.html               # HTML container
└── package.json             # Dependencies
```

## How to Play

1. Open `http://localhost:8080` in your browser
2. Click on a piece to select it (legal moves will be highlighted)
3. Click on a highlighted square to make a move
4. Players alternate (white = Fremen/Atreides, black = Sardaukar)

## Controls

- **Left Click:** Select a piece / Make a move
- **ESC:** Cancel selection
- **Mouse Drag:** Rotate camera around the board
- **Scroll Wheel:** Zoom in/out
- **Right-Click + Drag:** Pan the camera

## Implementation Status

### Phase 1 (MVP) - Complete
- [x] 3D board rendering
- [x] 3D model loading (Fremen + Sardaukar)
- [x] Piece placement at starting positions
- [x] Input handling (clicks)
- [x] Move validation (chess.js)
- [x] Player turn switching
- [x] Check/checkmate/stalemate detection
- [x] Piece movement animation
- [x] Game status UI
- [x] Orbit-style camera controls

### Phase 2 (Graphics) - Planned
- [ ] Smooth animations
- [ ] Particle effects (capture effect)
- [ ] Post-processing (bloom, depth-of-field)
- [ ] 3-point lighting improvements
- [ ] Real-time shadows

### Phase 3 (AI) - Planned
- [ ] AI opponent (Stockfish.js)
- [ ] Difficulty levels
- [ ] AI thinking animation

### Phase 4 (Polish) - Planned
- [ ] Sound effects
- [ ] Move history panel
- [ ] Save/load games
- [ ] Settings menu

## Debug Console

After starting the game, the `gameEngine` object is available in the browser console:

```javascript
// Reset the game
gameEngine.resetGame()

// Undo the last move
gameEngine.undoMove()

// Show the current game state
console.log(gameEngine.getGameState())
```

## System Requirements

- Modern browser with WebGL support (Chrome 90+, Firefox 88+, Safari 14+)
- ~50MB RAM
- Internet connection to fetch Babylon.js

## Future TODO

- [ ] Optimize bundle size (currently ~11MB)
- [ ] Add WebGPU support
- [ ] Multiplayer via WebSockets
- [ ] Mobile touch controls
- [ ] Dark mode UI
- [ ] Replay system

## License

MIT

## Credits

- 3D Models: Sketchfab (Sardaukar by ptibogvader, Fremen by ...)
- Chess Logic: chess.js
- 3D Engine: Babylon.js
- Inspiration: Frank Herbert's Dune
