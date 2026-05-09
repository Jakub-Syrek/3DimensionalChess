import { GameEngine } from './game-engine';

// Initialize game when DOM is ready
async function initializeGame(): Promise<void> {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  const loadingElement = document.getElementById('loading') as HTMLElement;

  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  try {
    // Create game engine
    const gameEngine = new GameEngine(canvas);

    // Initialize (load models, create board, place pieces)
    console.log('Initializing game...');
    await gameEngine.initialize();

    // Hide loading screen
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    // Start rendering
    gameEngine.start();

    // Expose game engine for console debugging
    (window as any).gameEngine = gameEngine;

    console.log('✓ Game ready!');
    console.log('Use gameEngine.resetGame() or gameEngine.undoMove() in console');
  } catch (error) {
    console.error('Failed to initialize game:', error);
    if (loadingElement) {
      loadingElement.innerHTML = `
        <h2>⚠️ Error Loading Game</h2>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        <p>Check console for details</p>
      `;
    }
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}
