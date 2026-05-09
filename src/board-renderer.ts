import * as BABYLON from 'babylonjs';
import { Position } from './utils/types';
import {
  BOARD_SIZE,
  SQUARE_SIZE,
  BOARD_HEIGHT,
  HIGHLIGHT_COLOR_LEGAL,
  HIGHLIGHT_COLOR_SELECTED,
  HIGHLIGHT_COLOR_LAST_MOVE
} from './utils/constants';
import { boardToWorldPosition } from './utils/helpers';

export class BoardRenderer {
  private scene: BABYLON.Scene;
  private boardMesh: BABYLON.Mesh;
  private highlightMeshes: Map<string, BABYLON.Mesh> = new Map();
  private lightMaterial: BABYLON.StandardMaterial;
  private darkMaterial: BABYLON.StandardMaterial;
  private highlightMaterials: Map<string, BABYLON.StandardMaterial> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.boardMesh = new BABYLON.Mesh('board', scene);
    this.setupMaterials();
  }

  private setupMaterials(): void {
    // Light square material - bright cream
    this.lightMaterial = new BABYLON.StandardMaterial('light-square', this.scene);
    this.lightMaterial.diffuse = new BABYLON.Color3(1.0, 0.95, 0.8);
    this.lightMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    this.lightMaterial.emissiveColor = new BABYLON.Color3(0.15, 0.13, 0.10);

    // Dark square material - much darker for high contrast
    this.darkMaterial = new BABYLON.StandardMaterial('dark-square', this.scene);
    this.darkMaterial.diffuse = new BABYLON.Color3(0.15, 0.08, 0.03);
    this.darkMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    // Highlight materials
    const createHighlightMaterial = (name: string, color: BABYLON.Color3) => {
      const mat = new BABYLON.StandardMaterial(name, this.scene);
      mat.diffuse = color;
      mat.alpha = 0.6;
      mat.emissiveColor = color;
      this.highlightMaterials.set(name, mat);
      return mat;
    };

    createHighlightMaterial('highlight-legal', BABYLON.Color3.FromHexString(HIGHLIGHT_COLOR_LEGAL));
    createHighlightMaterial('highlight-selected', BABYLON.Color3.FromHexString(HIGHLIGHT_COLOR_SELECTED));
    createHighlightMaterial('highlight-last-move', BABYLON.Color3.FromHexString(HIGHLIGHT_COLOR_LAST_MOVE));
  }

  // Create the board geometry
  createBoard(): void {
    const squareGeometry = BABYLON.MeshBuilder.CreateBox('square', { size: SQUARE_SIZE }, this.scene);

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const isLight = (x + y) % 2 === 0;
        const position = boardToWorldPosition({ x, y }, BOARD_HEIGHT / 2);

        const square = squareGeometry.clone(`square-${x}-${y}`);
        square.position = new BABYLON.Vector3(position.x, position.y, position.z);
        square.material = isLight ? this.lightMaterial : this.darkMaterial;

        // Scale square to be thinner
        square.scaling.y = 0.3;
      }
    }

    // Remove the original
    squareGeometry.dispose();

    // Create board frame/border
    this.createBoardFrame();
  }

  private createBoardFrame(): void {
    const frameSize = BOARD_SIZE * SQUARE_SIZE;
    const frameHeight = 0.4;
    const frameThickness = 0.2;

    const frameMaterial = new BABYLON.StandardMaterial('frame', this.scene);
    frameMaterial.diffuse = new BABYLON.Color3(0.2, 0.15, 0.1);

    // Frame edges
    const framePositions = [
      { name: 'front', pos: new BABYLON.Vector3(0, frameHeight / 2, frameSize / 2 + frameThickness / 2) },
      { name: 'back', pos: new BABYLON.Vector3(0, frameHeight / 2, -frameSize / 2 - frameThickness / 2) },
      { name: 'left', pos: new BABYLON.Vector3(-frameSize / 2 - frameThickness / 2, frameHeight / 2, 0) },
      { name: 'right', pos: new BABYLON.Vector3(frameSize / 2 + frameThickness / 2, frameHeight / 2, 0) }
    ];

    framePositions.forEach(frame => {
      const borderBox = BABYLON.MeshBuilder.CreateBox(`border-${frame.name}`, {
        width: frame.name === 'left' || frame.name === 'right' ? frameThickness : frameSize + frameThickness * 2,
        height: frameHeight,
        depth: frame.name === 'front' || frame.name === 'back' ? frameThickness : frameSize + frameThickness * 2
      }, this.scene);
      borderBox.position = frame.pos;
      borderBox.material = frameMaterial;
    });
  }

  // Highlight a square as a legal move
  highlightLegalMove(position: Position): void {
    this.addHighlight(position, 'legal');
  }

  // Highlight multiple legal moves
  highlightLegalMoves(positions: Position[]): void {
    positions.forEach(pos => this.highlightLegalMove(pos));
  }

  // Highlight a selected piece
  highlightSelectedPiece(position: Position): void {
    this.addHighlight(position, 'selected');
  }

  // Highlight last move
  highlightLastMove(from: Position, to: Position): void {
    this.addHighlight(from, 'last-move');
    this.addHighlight(to, 'last-move');
  }

  private addHighlight(position: Position, type: 'legal' | 'selected' | 'last-move'): void {
    const key = `${type}-${position.x}-${position.y}`;

    if (this.highlightMeshes.has(key)) {
      return; // Already highlighted
    }

    const worldPos = boardToWorldPosition(position, BOARD_HEIGHT + 0.05);
    const highlight = BABYLON.MeshBuilder.CreateBox(`highlight-${key}`, {
      size: SQUARE_SIZE
    }, this.scene);

    highlight.position = new BABYLON.Vector3(worldPos.x, worldPos.y, worldPos.z);
    highlight.scaling.y = 0.1;

    const materialName = `highlight-${type}`;
    highlight.material = this.highlightMaterials.get(materialName);

    this.highlightMeshes.set(key, highlight);
  }

  // Clear all highlights
  clearHighlights(): void {
    this.highlightMeshes.forEach(mesh => mesh.dispose());
    this.highlightMeshes.clear();
  }

  // Clear highlights by type
  clearHighlightsByType(type: 'legal' | 'selected' | 'last-move'): void {
    const keysToDelete: string[] = [];
    this.highlightMeshes.forEach((mesh, key) => {
      if (key.startsWith(type)) {
        mesh.dispose();
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.highlightMeshes.delete(key));
  }

  // Dispose all meshes
  dispose(): void {
    this.clearHighlights();
    this.boardMesh.dispose();
    this.lightMaterial.dispose();
    this.darkMaterial.dispose();
    this.highlightMaterials.forEach(mat => mat.dispose());
  }

  // Get board mesh for adding children
  getBoard(): BABYLON.Mesh {
    return this.boardMesh;
  }
}
