import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { Piece, PieceType, Position } from './utils/types';
import { boardToWorldPosition } from './utils/helpers';
import { SQUARE_SIZE, BOARD_HEIGHT } from './utils/constants';

export class PieceRenderer {
  private scene: BABYLON.Scene;
  private pieceMeshes: Map<string, BABYLON.Mesh> = new Map();
  private sardaukarModel: BABYLON.Mesh | null = null; // Black pieces
  private fremenModel: BABYLON.Mesh | null = null; // White pieces
  private selectedMaterial: BABYLON.StandardMaterial;
  private whiteMaterial: BABYLON.StandardMaterial;
  private blackMaterial: BABYLON.StandardMaterial;
  private modelsLoaded = false;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.setupMaterials();
  }

  private setupMaterials(): void {
    // White piece material (Fremen - sand/tan colors)
    this.whiteMaterial = new BABYLON.StandardMaterial('white-piece', this.scene);
    this.whiteMaterial.diffuse = new BABYLON.Color3(0.8, 0.7, 0.5);
    this.whiteMaterial.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    this.whiteMaterial.specularPower = 32;

    // Black piece material (Sardaukar - dark metallic with strong specular)
    this.blackMaterial = new BABYLON.StandardMaterial('black-piece', this.scene);
    this.blackMaterial.diffuse = new BABYLON.Color3(0.35, 0.35, 0.4);
    this.blackMaterial.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    this.blackMaterial.specularPower = 64;
    this.blackMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.15);

    // Selected piece material (glow)
    this.selectedMaterial = new BABYLON.StandardMaterial('selected-piece', this.scene);
    this.selectedMaterial.diffuse = new BABYLON.Color3(1, 1, 0);
    this.selectedMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0);
  }

  // Load Fremen and Sardaukar models from assets
  async loadModels(): Promise<void> {
    try {
      // Load Sardaukar model (black pieces)
      console.log('Loading Sardaukar model...');
      const sardaukarResult = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        'assets/models/',
        'sardaukar.glb',
        this.scene
      );

      if (sardaukarResult.meshes.length > 0) {
        this.sardaukarModel = sardaukarResult.meshes[0] as BABYLON.Mesh;
        this.sardaukarModel.scaling.scaleInPlace(0.6);
        // Keep Sardaukar's natural imported quaternion (0,1,0,0)
        // Position template off-screen instead of hiding
        this.sardaukarModel.position.y = -100;
        console.log('✓ Sardaukar model loaded', { meshCount: sardaukarResult.meshes.length, model: !!this.sardaukarModel });
      } else {
        console.warn('✗ Sardaukar - no meshes loaded', sardaukarResult.meshes.length);
      }

      // Load Fremen model (white pieces) - store all meshes for proper cloning
      console.log('Loading Fremen model...');
      const fremenResult = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        'assets/models/',
        'fremen_of_dune.glb',
        this.scene
      );

      if (fremenResult.meshes.length > 0) {
        // Store all loaded meshes for cloning
        (this as any).fremenAllMeshes = fremenResult.meshes;
        this.fremenModel = fremenResult.meshes[0] as BABYLON.Mesh;
        this.fremenModel.scaling.scaleInPlace(0.018);
        // Set Fremen to identity quaternion to flip it 180° from imported orientation
        this.fremenModel.rotationQuaternion = BABYLON.Quaternion.Identity();
        // Position template off-screen instead of hiding
        this.fremenModel.position.y = -100;
        console.log(`✓ Fremen model loaded (${fremenResult.meshes.length} meshes)`);
      }

      this.modelsLoaded = true;
      console.log('✓ All models loaded successfully');
    } catch (error) {
      console.error('✗ Failed to load models:', error);
      console.log('Falling back to placeholder models...');
      this.createPiecePlaceholders();
      this.modelsLoaded = false; // Explicitly mark that we're using fallback
    }
  }

  // Create placeholder piece models as fallback (geometric shapes)
  private createPiecePlaceholders(): void {
    if (!this.sardaukarModel) {
      this.sardaukarModel = BABYLON.MeshBuilder.CreateSphere('sardaukar-placeholder', {
        segments: 16,
        diameter: SQUARE_SIZE * 0.3
      }, this.scene);
      this.sardaukarModel.isVisible = false;
    }

    if (!this.fremenModel) {
      this.fremenModel = BABYLON.MeshBuilder.CreateSphere('fremen-placeholder', {
        segments: 16,
        diameter: SQUARE_SIZE * 0.3
      }, this.scene);
      this.fremenModel.isVisible = false;
    }
  }

  // Place pieces on the board
  placePieces(pieces: Piece[]): void {
    if (!this.sardaukarModel) {
      console.error('Models not loaded yet');
      return;
    }

    pieces.forEach(piece => {
      this.updatePiecePosition(piece);
    });
  }

  private updatePiecePosition(piece: Piece): void {
    const key = `piece-${piece.color}-${piece.type}-${piece.position.x}-${piece.position.y}`;

    let mesh = this.pieceMeshes.get(key);

    if (!mesh) {
      if (piece.color === 'white' && this.fremenModel) {
        // Clone Fremen model for white pieces - flip 180° via identity quaternion
        mesh = this.fremenModel.clone(`white-${key}`) as BABYLON.Mesh;
        mesh.material = this.whiteMaterial;
        mesh.getChildMeshes().forEach(child => child.material = this.whiteMaterial);
        // Force identity quaternion on white clones to rotate 180° from imported orientation
        mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
        mesh.rotation = BABYLON.Vector3.Zero();
        console.log(`✓ Created white ${piece.type} at ${piece.position.x},${piece.position.y} | quat=identity`);
      } else if (piece.color === 'black' && this.sardaukarModel) {
        // Clone Sardaukar model - keep imported quaternion
        mesh = this.sardaukarModel.clone(`black-${key}`) as BABYLON.Mesh;
        mesh.material = this.blackMaterial;
        mesh.getChildMeshes().forEach(child => {
          child.material = this.blackMaterial;
        });
        console.log(`✓ Created black ${piece.type} at ${piece.position.x},${piece.position.y} | model=exists, mesh=cloned`);
      } else if (piece.color === 'black' && !this.sardaukarModel) {
        // Debug: sardaukar model is null
        console.warn(`✗ Sardaukar model is NULL for black ${piece.type} at ${piece.position.x},${piece.position.y}`);
      }

      if (!mesh) {
        // Fallback to placeholder spheres if models not available
        mesh = BABYLON.MeshBuilder.CreateSphere(`fallback-${key}`, {
          segments: 16,
          diameter: SQUARE_SIZE * 0.4
        }, this.scene);
        mesh.material = piece.color === 'white' ? this.whiteMaterial : this.blackMaterial;
        console.log(`⚠ Fallback sphere for ${piece.color} ${piece.type} (fremen: ${!!this.fremenModel}, sardaukar: ${!!this.sardaukarModel})`);
      }

      this.pieceMeshes.set(key, mesh);
    }

    if (mesh) {
      // Higher placement for black pieces so they're visible above the board
      const heightOffset = piece.color === 'black' ? BOARD_HEIGHT / 2 + SQUARE_SIZE * 0.8 : BOARD_HEIGHT / 2 + SQUARE_SIZE * 0.3;
      const worldPos = boardToWorldPosition(piece.position, heightOffset);
      // Sardaukar: shift toward screen-down (+X, +Z in world with this camera)
      const offsetX = piece.color === 'black' ? 0.3 : 0;
      const offsetZ = piece.color === 'black' ? 0.25 : 0;
      mesh.position = new BABYLON.Vector3(worldPos.x + offsetX, worldPos.y, worldPos.z + offsetZ);
    }
  }

  // Move a piece smoothly to new position
  async movePiece(from: Position, to: Position): Promise<void> {
    // Find the piece mesh
    const meshKey = Array.from(this.pieceMeshes.keys()).find(key => {
      const mesh = this.pieceMeshes.get(key);
      if (!mesh) return false;
      // Check if mesh is at 'from' position
      const fromWorld = boardToWorldPosition(from, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
      return Math.abs(mesh.position.x - fromWorld.x) < 0.1 &&
             Math.abs(mesh.position.z - fromWorld.z) < 0.1;
    });

    if (!meshKey) {
      console.warn(`No mesh found for piece at ${from.x},${from.y}`);
      return;
    }

    const mesh = this.pieceMeshes.get(meshKey)!;
    const toWorld = boardToWorldPosition(to, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
    const targetPosition = new BABYLON.Vector3(toWorld.x, toWorld.y, toWorld.z);

    return new Promise(resolve => {
      BABYLON.Animation.CreateAndStartAnimation(
        'movePiece',
        mesh,
        'position',
        60, // FPS
        30, // Frames (0.5 seconds)
        mesh.position.clone(),
        targetPosition,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
        new BABYLON.CubicEase(),
        () => resolve()
      );
    });
  }

  // Remove a piece from the board (for captures)
  removePiece(position: Position): void {
    const keysToRemove: string[] = [];

    this.pieceMeshes.forEach((mesh, key) => {
      const worldPos = boardToWorldPosition(position, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
      if (Math.abs(mesh.position.x - worldPos.x) < 0.1 &&
          Math.abs(mesh.position.z - worldPos.z) < 0.1) {
        mesh.dispose();
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => this.pieceMeshes.delete(key));
  }

  // Highlight a piece
  selectPiece(position: Position): void {
    const worldPos = boardToWorldPosition(position, BOARD_HEIGHT + SQUARE_SIZE * 0.2);

    this.pieceMeshes.forEach(mesh => {
      if (Math.abs(mesh.position.x - worldPos.x) < 0.1 &&
          Math.abs(mesh.position.z - worldPos.z) < 0.1) {
        mesh.material = this.selectedMaterial;
        mesh.getChildMeshes().forEach(child => {
          child.material = this.selectedMaterial;
        });
      }
    });
  }

  // Deselect all pieces
  deselectAll(pieces: Piece[]): void {
    pieces.forEach(piece => {
      const material = piece.color === 'white' ? this.whiteMaterial : this.blackMaterial;
      const key = `piece-${piece.color}-${piece.type}-${piece.position.x}-${piece.position.y}`;
      const mesh = this.pieceMeshes.get(key);

      if (mesh) {
        mesh.material = material;
        mesh.getChildMeshes().forEach(child => {
          child.material = material;
        });
      }
    });
  }

  // Update all pieces positions
  updateAllPieces(pieces: Piece[]): void {
    pieces.forEach(piece => this.updatePiecePosition(piece));
  }

  // Dispose all resources
  dispose(): void {
    this.pieceMeshes.forEach(mesh => mesh.dispose());
    this.pieceMeshes.clear();
    if (this.sardaukarModel) this.sardaukarModel.dispose();
    if (this.fremenModel) this.fremenModel.dispose();
    this.whiteMaterial.dispose();
    this.blackMaterial.dispose();
    this.selectedMaterial.dispose();
  }
}
