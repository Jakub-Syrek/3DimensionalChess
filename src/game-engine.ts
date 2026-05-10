import * as BABYLON from 'babylonjs';
import { BoardRenderer } from './board-renderer';
import { PieceRenderer } from './piece-renderer';
import { InputHandler, InputEvent } from './input-handler';
import { ChessEngine } from './chess-engine';
import { GameState, Position } from './utils/types';
import { CAMERA_DISTANCE, CAMERA_ANGLE } from './utils/constants';

export class GameEngine {
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene;
  private canvas: HTMLCanvasElement;

  private boardRenderer: BoardRenderer;
  private pieceRenderer: PieceRenderer;
  private inputHandler: InputHandler;
  private chessEngine: ChessEngine;

  private gameState: GameState;
  private selectedPiece: Position | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      alpha: true,
      antialias: true
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.15, 0.25, 0.35, 1);
    this.scene.collisionsEnabled = true;

    this.boardRenderer = new BoardRenderer(this.scene);
    this.pieceRenderer = new PieceRenderer(this.scene);
    this.inputHandler = new InputHandler(this.scene, canvas);
    this.chessEngine = new ChessEngine();

    this.gameState = {
      pieces: this.chessEngine.getPieces(),
      currentPlayer: this.chessEngine.getCurrentPlayer(),
      moveHistory: [],
      status: 'in-progress',
      selectedPiece: null,
      legalMoves: []
    };

    this.setupScene();
    this.setupInputHandlers();
  }

  private setupScene(): void {
    // Camera setup - ArcRotateCamera for orbit-style controls
    // alpha = horizontal rotation (around Y axis)
    // beta = vertical rotation (from top)
    // radius = distance from target
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 4,           // alpha - 45° horizontal
      Math.PI / 3.5,         // beta - tilt down
      14,                    // radius - distance
      BABYLON.Vector3.Zero(), // target - board center
      this.scene
    );
    camera.attachControl(this.canvas, true);
    camera.minZ = 0.1;
    camera.maxZ = 500;

    // Limits to prevent flipping under the board
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI / 2.1;

    // Zoom limits
    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 30;

    // Smooth controls
    camera.inertia = 0.85;
    camera.angularSensibilityX = 1000;
    camera.angularSensibilityY = 1000;
    camera.wheelPrecision = 30;
    camera.panningSensibility = 100;

    // Lighting setup - 3-point lighting with shadow casting
    // Key light: directional sun-like light pointing down-left for angled shadows.
    const keyLight = new BABYLON.DirectionalLight('keyLight', new BABYLON.Vector3(-0.5, -1, -0.4), this.scene);
    keyLight.position = new BABYLON.Vector3(8, 12, 6);
    keyLight.intensity = 0.5;
    keyLight.shadowMinZ = 1;
    keyLight.shadowMaxZ = 30;

    // Shadow generator on the key light (PCF soft shadows)
    const shadowGenerator = new BABYLON.ShadowGenerator(2048, keyLight);
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
    shadowGenerator.bias = 0.0008;
    shadowGenerator.normalBias = 0.02;
    shadowGenerator.darkness = 0.35;
    shadowGenerator.transparencyShadow = false;

    // Hand the shadow generator to renderers so they can register casters/receivers
    this.boardRenderer.setShadowGenerator(shadowGenerator);
    this.pieceRenderer.setShadowGenerator(shadowGenerator);

    // Connect the piece renderer to the board's mirror so pieces are reflected
    this.pieceRenderer.setReflectionRegister(meshes => this.boardRenderer.addReflectionTargets(meshes));

    // Fill light - softens the shadow side
    const fillLight = new BABYLON.HemisphericLight('fillLight', new BABYLON.Vector3(-1, 1, -1), this.scene);
    fillLight.intensity = 0.15;
    fillLight.diffuse = new BABYLON.Color3(0.8, 0.85, 1);
    fillLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

    // Back light - rim light
    const backLight = new BABYLON.PointLight('backLight', new BABYLON.Vector3(0, 5, -8), this.scene);
    backLight.intensity = 0.1;

    // Ambient light - low to keep shadows visible
    this.scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.12);
  }

  private setupInputHandlers(): void {
    this.inputHandler.addEventListener((event: InputEvent) => {
      this.handleInput(event);
    });
  }

  private handleInput(event: InputEvent): void {
    switch (event.type) {
      case 'piece-selected':
        this.selectPiece(event.position);
        break;

      case 'move-attempted':
        this.attemptMove(event.position);
        break;

      case 'board-clicked':
        this.deselectPiece();
        break;
    }
  }

  private selectPiece(position: Position): void {
    const piece = this.chessEngine.getPieceAt(position);

    // Check if piece belongs to current player
    if (!piece || piece.color !== this.gameState.currentPlayer) {
      return;
    }

    this.selectedPiece = position;
    this.gameState.selectedPiece = position;

    // Get legal moves for this piece
    const legalMoves = this.chessEngine.getLegalMovesForPiece(position);
    this.gameState.legalMoves = legalMoves;

    // Update UI
    this.pieceRenderer.selectPiece(position);
    this.boardRenderer.highlightLegalMoves(legalMoves);

    console.log(`Selected ${piece.type} at ${position.x},${position.y}. Legal moves: ${legalMoves.length}`);
  }

  private async attemptMove(to: Position): Promise<void> {
    if (!this.selectedPiece) return;

    const from = this.selectedPiece;

    // Validate move
    if (!this.chessEngine.getLegalMovesForPiece(from).some(m => m.x === to.x && m.y === to.y)) {
      console.log('Illegal move');
      return;
    }

    // Detect capture BEFORE the chess engine updates state -
    // afterwards getPieceAt(to) returns the moving attacker, not the defender.
    const isCapture = !!this.chessEngine.getPieceAt(to);

    // Make move in chess engine
    const success = this.chessEngine.makeMove(from, to);
    if (!success) return;

    // Animate the attacker's arc and the defender's death in parallel.
    const captureAnim = isCapture ? this.pieceRenderer.removePiece(to) : Promise.resolve();
    await Promise.all([
      this.pieceRenderer.movePiece(from, to),
      captureAnim,
    ]);

    // Update piece positions
    this.gameState.pieces = this.chessEngine.getPieces();
    this.pieceRenderer.updateAllPieces(this.gameState.pieces);

    // Clear highlights
    this.boardRenderer.clearHighlights();
    this.pieceRenderer.deselectAll(this.gameState.pieces);

    // Switch player
    this.gameState.currentPlayer = this.chessEngine.getCurrentPlayer();
    this.gameState.selectedPiece = null;
    this.selectedPiece = null;

    // Update game status
    this.gameState.status = this.chessEngine.getGameStatus();
    this.gameState.moveHistory = this.chessEngine.getMoveHistory();

    console.log(`Move: ${from.x},${from.y} → ${to.x},${to.y}. Current player: ${this.gameState.currentPlayer}`);

    // Update UI
    this.updateStatusUI();
  }

  private deselectPiece(): void {
    this.selectedPiece = null;
    this.gameState.selectedPiece = null;
    this.gameState.legalMoves = [];

    this.boardRenderer.clearHighlights();
    this.pieceRenderer.deselectAll(this.gameState.pieces);
  }

  private updateStatusUI(): void {
    const currentPlayerEl = document.getElementById('currentPlayer');
    const moveCountEl = document.getElementById('moveCount');
    const gameStatusEl = document.getElementById('gameStatus');

    if (currentPlayerEl) {
      currentPlayerEl.textContent = this.gameState.currentPlayer === 'white' ? 'White (Atreides)' : 'Black (Sardaukar)';
    }

    if (moveCountEl) {
      moveCountEl.textContent = this.gameState.moveHistory.length.toString();
    }

    if (gameStatusEl) {
      const statusText = {
        'in-progress': 'In Progress',
        'check': '⚠️ Check!',
        'checkmate': '✓ Checkmate!',
        'stalemate': 'Stalemate',
        'draw': 'Draw'
      };
      gameStatusEl.textContent = statusText[this.gameState.status] || 'Unknown';
    }
  }

  async initialize(): Promise<void> {
    // Load models
    await this.pieceRenderer.loadModels();

    // Create board
    this.boardRenderer.createBoard();

    // Place pieces
    this.pieceRenderer.placePieces(this.gameState.pieces);

    // Update UI
    this.updateStatusUI();

    console.log('✓ Game initialized successfully');
  }

  start(): void {
    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    // Main render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    console.log('✓ Game started');
  }

  stop(): void {
    this.engine.dispose();
  }

  // Public methods for game control
  resetGame(): void {
    this.chessEngine.reset();
    this.gameState.pieces = this.chessEngine.getPieces();
    this.gameState.currentPlayer = this.chessEngine.getCurrentPlayer();
    this.gameState.moveHistory = [];
    this.gameState.status = 'in-progress';

    this.pieceRenderer.updateAllPieces(this.gameState.pieces);
    this.boardRenderer.clearHighlights();
    this.deselectPiece();
    this.updateStatusUI();
  }

  undoMove(): void {
    const move = this.chessEngine.undoMove();
    if (move) {
      this.gameState.pieces = this.chessEngine.getPieces();
      this.gameState.currentPlayer = this.chessEngine.getCurrentPlayer();
      this.gameState.moveHistory = this.chessEngine.getMoveHistory();
      this.gameState.status = this.chessEngine.getGameStatus();

      this.pieceRenderer.updateAllPieces(this.gameState.pieces);
      this.boardRenderer.clearHighlights();
      this.updateStatusUI();

      console.log('Move undone');
    }
  }

  getGameState(): GameState {
    return this.gameState;
  }
}
