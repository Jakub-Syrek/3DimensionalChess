import * as BABYLON from 'babylonjs';
import { Position } from './utils/types';
import { SQUARE_SIZE, BOARD_SIZE } from './utils/constants';
import { boardToWorldPosition } from './utils/helpers';

export interface InputEvent {
  type: 'piece-selected' | 'move-attempted' | 'board-clicked';
  position: Position;
}

export type InputCallback = (event: InputEvent) => void;

export class InputHandler {
  private scene: BABYLON.Scene;
  private canvas: HTMLCanvasElement;
  private callbacks: InputCallback[] = [];
  private selectedPosition: Position | null = null;

  constructor(scene: BABYLON.Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;
    this.setupInputListeners();
  }

  private setupInputListeners(): void {
    // Mouse click
    this.canvas.addEventListener('click', (event: MouseEvent) => {
      this.handleCanvasClick(event);
    });

    // Keyboard for debugging/future use
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      this.handleKeydown(event);
    });
  }

  private handleCanvasClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const position = this.screenToBoard(x, y);
    if (!position) return;

    // If clicking the same square, deselect
    if (this.selectedPosition &&
        this.selectedPosition.x === position.x &&
        this.selectedPosition.y === position.y) {
      this.selectedPosition = null;
      this.emit({
        type: 'board-clicked',
        position
      });
      return;
    }

    // If a piece is already selected, attempt move
    if (this.selectedPosition) {
      this.emit({
        type: 'move-attempted',
        position
      });
      this.selectedPosition = null;
    } else {
      // Select this piece
      this.selectedPosition = position;
      this.emit({
        type: 'piece-selected',
        position
      });
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    // Can be extended for keyboard shortcuts in future
    switch (event.key) {
      case 'Escape':
        this.selectedPosition = null;
        this.emit({
          type: 'board-clicked',
          position: { x: -1, y: -1 }
        });
        break;
    }
  }

  // Convert screen coordinates to board position
  private screenToBoard(screenX: number, screenY: number): Position | null {
    // Create a picking ray from the camera through the cursor (pixel coords).
    const ray = this.scene.createPickingRay(
      screenX,
      screenY,
      BABYLON.Matrix.Identity(),
      this.scene.activeCamera!
    );

    // Intersect with the board plane (top of board surface)
    const boardHeight = 0.2;
    const boardPlane = BABYLON.Plane.FromPositionAndNormal(
      new BABYLON.Vector3(0, boardHeight, 0),
      BABYLON.Axis.Y
    );

    const intersection = ray.intersectsPlane(boardPlane);
    if (intersection === null || intersection === undefined) return null;

    const point = ray.origin.add(ray.direction.scale(intersection));

    // Convert world position to board coordinates.
    // boardToWorldPosition: x = pos.x * SQUARE_SIZE - half + half_square,
    //                      z = (7 - pos.y) * SQUARE_SIZE - half + half_square
    // So invert: pos.x = (point.x + half - half_square) / SQUARE_SIZE
    //            pos.y = 7 - (point.z + half - half_square) / SQUARE_SIZE
    const halfBoardSize = (BOARD_SIZE * SQUARE_SIZE) / 2;
    const boardX = Math.round((point.x + halfBoardSize) / SQUARE_SIZE - 0.5);
    const boardY = (BOARD_SIZE - 1) - Math.round((point.z + halfBoardSize) / SQUARE_SIZE - 0.5);

    // Validate bounds
    if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) {
      return null;
    }

    return { x: boardX, y: boardY };
  }

  // Register a callback for input events
  addEventListener(callback: InputCallback): void {
    this.callbacks.push(callback);
  }

  // Remove callback
  removeEventListener(callback: InputCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  // Emit event to all listeners
  private emit(event: InputEvent): void {
    this.callbacks.forEach(callback => callback(event));
  }

  // Get currently selected position
  getSelectedPosition(): Position | null {
    return this.selectedPosition;
  }

  // Programmatically select a position
  selectPosition(position: Position | null): void {
    this.selectedPosition = position;
  }
}
