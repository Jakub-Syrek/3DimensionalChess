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
  // Track currently selected mesh so we can reliably restore its material on deselect
  // (key-based lookup breaks after a piece moves because the key encodes old position).
  private currentlySelectedMesh: BABYLON.Mesh | null = null;
  private currentlySelectedColor: 'white' | 'black' | null = null;
  private shadowGenerator: BABYLON.ShadowGenerator | null = null;
  private reflectionRegisterCallback: ((meshes: BABYLON.AbstractMesh[]) => void) | null = null;

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

  // Set the shadow generator so all created pieces are registered as casters.
  setShadowGenerator(generator: BABYLON.ShadowGenerator): void {
    this.shadowGenerator = generator;
    // Register any already-created pieces (e.g. if pieces were placed before this call).
    this.pieceMeshes.forEach(mesh => this.registerCasters(mesh));
  }

  // Allow another component (BoardRenderer) to receive reflection targets.
  setReflectionRegister(cb: (meshes: BABYLON.AbstractMesh[]) => void): void {
    this.reflectionRegisterCallback = cb;
    // Send any already-created pieces
    this.pieceMeshes.forEach(mesh => this.registerReflectionTargets(mesh));
  }

  // Collect renderable meshes (with geometry) from a root for reflection/shadow lists.
  private collectRenderable(rootMesh: BABYLON.Mesh): BABYLON.AbstractMesh[] {
    const result: BABYLON.AbstractMesh[] = [];
    if (rootMesh instanceof BABYLON.Mesh && rootMesh.getTotalVertices() > 0) {
      result.push(rootMesh);
    }
    rootMesh.getChildMeshes().forEach(m => {
      if (m instanceof BABYLON.Mesh && m.getTotalVertices() > 0) result.push(m);
    });
    return result;
  }

  // Add a mesh and all its renderable descendants to the shadow caster list.
  private registerCasters(rootMesh: BABYLON.Mesh): void {
    if (!this.shadowGenerator) return;
    const renderList = this.shadowGenerator.getShadowMap()?.renderList;
    if (!renderList) return;
    this.collectRenderable(rootMesh).forEach(m => {
      if (!renderList.includes(m)) renderList.push(m);
    });
  }

  // Push this piece's renderable meshes to the board's reflection list.
  private registerReflectionTargets(rootMesh: BABYLON.Mesh): void {
    if (!this.reflectionRegisterCallback) return;
    this.reflectionRegisterCallback(this.collectRenderable(rootMesh));
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

      // Register the new piece (and its children) as a shadow caster and reflection target
      this.registerCasters(mesh);
      this.registerReflectionTargets(mesh);
    }

    if (mesh) {
      // Sit pieces on the board surface
      const heightOffset = piece.color === 'black' ? BOARD_HEIGHT / 2 + SQUARE_SIZE * 0.3 : BOARD_HEIGHT / 2 + SQUARE_SIZE * 0.3;
      const worldPos = boardToWorldPosition(piece.position, heightOffset);
      // Sardaukar: align body/base center on square center
      const offsetX = piece.color === 'black' ? 0 : 0;
      const offsetZ = piece.color === 'black' ? -0.05 : 0;
      mesh.position = new BABYLON.Vector3(worldPos.x + offsetX, worldPos.y, worldPos.z + offsetZ);
    }
  }

  // Move a piece smoothly to new position with an arc jump
  async movePiece(from: Position, to: Position): Promise<void> {
    // Find the piece mesh
    const meshKey = Array.from(this.pieceMeshes.keys()).find(key => {
      const mesh = this.pieceMeshes.get(key);
      if (!mesh) return false;
      const fromWorld = boardToWorldPosition(from, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
      return Math.abs(mesh.position.x - fromWorld.x) < 0.1 &&
             Math.abs(mesh.position.z - fromWorld.z) < 0.1;
    });

    if (!meshKey) {
      console.warn(`No mesh found for piece at ${from.x},${from.y}`);
      return;
    }

    const mesh = this.pieceMeshes.get(meshKey)!;
    const startPos = mesh.position.clone();
    const toWorld = boardToWorldPosition(to, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
    const endPos = new BABYLON.Vector3(toWorld.x, startPos.y, toWorld.z);

    // Compute arc: peak at midpoint, lifted by jump height
    const distance = BABYLON.Vector3.Distance(startPos, endPos);
    const jumpHeight = Math.min(1.5, 0.5 + distance * 0.2);
    const midPos = new BABYLON.Vector3(
      (startPos.x + endPos.x) / 2,
      startPos.y + jumpHeight,
      (startPos.z + endPos.z) / 2
    );

    const fps = 60;
    const totalFrames = 36; // 0.6 seconds

    const arcAnimation = new BABYLON.Animation(
      'movePieceArc',
      'position',
      fps,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    arcAnimation.setKeys([
      { frame: 0, value: startPos },
      { frame: totalFrames / 2, value: midPos },
      { frame: totalFrames, value: endPos },
    ]);

    const ease = new BABYLON.SineEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    arcAnimation.setEasingFunction(ease);

    return new Promise(resolve => {
      this.scene.beginDirectAnimation(
        mesh,
        [arcAnimation],
        0,
        totalFrames,
        false,
        1,
        () => resolve()
      );
    });
  }

  // 3-phase combat animation for capturing moves.
  // Phase 1 - APPROACH: attacker arcs ~80% of the way (no defender contact yet)
  // Phase 2 - STRIKE: attacker lunges forward, defender shakes violently, sparks fly, camera shakes
  // Phase 3 - WITHDRAWAL: attacker completes the move to the captured square,
  //                       defender sinks/scales/fades and is disposed.
  async attackPiece(from: Position, to: Position): Promise<void> {
    // Find attacker mesh by its current position
    const attackerKey = Array.from(this.pieceMeshes.keys()).find(key => {
      const m = this.pieceMeshes.get(key);
      if (!m) return false;
      const fromWorld = boardToWorldPosition(from, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
      return Math.abs(m.position.x - fromWorld.x) < 0.1 &&
             Math.abs(m.position.z - fromWorld.z) < 0.1;
    });
    if (!attackerKey) {
      console.warn(`No attacker mesh at ${from.x},${from.y}`);
      return;
    }
    const attacker = this.pieceMeshes.get(attackerKey)!;

    // Find defender mesh(es) at the destination
    const defenderEntries: { mesh: BABYLON.Mesh; key: string }[] = [];
    const toWorld = boardToWorldPosition(to, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
    this.pieceMeshes.forEach((m, k) => {
      if (k === attackerKey) return;
      if (Math.abs(m.position.x - toWorld.x) < 0.1 &&
          Math.abs(m.position.z - toWorld.z) < 0.1) {
        defenderEntries.push({ mesh: m, key: k });
      }
    });

    const startPos = attacker.position.clone();
    const endPos = new BABYLON.Vector3(toWorld.x, startPos.y, toWorld.z);
    // 80% point along the path, lifted (peak of arc on approach)
    const approachPos = BABYLON.Vector3.Lerp(startPos, endPos, 0.78);
    const distance = BABYLON.Vector3.Distance(startPos, endPos);
    const jumpHeight = Math.min(1.5, 0.5 + distance * 0.2);
    approachPos.y += jumpHeight * 0.7;

    const fps = 60;

    // ---- Phase 1: APPROACH (~0.35s) ----
    const approachAnim = new BABYLON.Animation(
      'attackApproach', 'position', fps,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    approachAnim.setKeys([
      { frame: 0, value: startPos },
      { frame: 21, value: approachPos },
    ]);
    const approachEase = new BABYLON.SineEase();
    approachEase.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEIN);
    approachAnim.setEasingFunction(approachEase);

    await new Promise<void>(resolve => {
      this.scene.beginDirectAnimation(attacker, [approachAnim], 0, 21, false, 1, () => resolve());
    });

    // ---- Phase 2: STRIKE (~0.2s) ----
    // Attacker lunges forward by ~0.15 units, then snaps back.
    const lungeForward = BABYLON.Vector3.Lerp(approachPos, endPos, 0.25);

    // Spawn the spark burst at the strike location
    this.createCaptureBurst(new BABYLON.Vector3(toWorld.x, toWorld.y + 0.4, toWorld.z));

    // Camera shake (subtle)
    this.shakeCamera(140);

    // Shake the defender(s) violently in place during the strike
    const defenderShakes = defenderEntries.map(({ mesh }) => this.shakeMesh(mesh, 140, 0.04));

    const strikeLunge = new BABYLON.Animation(
      'attackLunge', 'position', fps,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    strikeLunge.setKeys([
      { frame: 0, value: approachPos },
      { frame: 6, value: lungeForward },
      { frame: 12, value: approachPos },
    ]);
    await Promise.all([
      new Promise<void>(resolve => {
        this.scene.beginDirectAnimation(attacker, [strikeLunge], 0, 12, false, 1, () => resolve());
      }),
      ...defenderShakes,
    ]);

    // ---- Phase 3: WITHDRAWAL + defender death (~0.45s) ----
    const finishAnim = new BABYLON.Animation(
      'attackFinish', 'position', fps,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    finishAnim.setKeys([
      { frame: 0, value: approachPos },
      { frame: 18, value: endPos },
    ]);
    const finishEase = new BABYLON.SineEase();
    finishEase.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
    finishAnim.setEasingFunction(finishEase);

    const attackerFinish = new Promise<void>(resolve => {
      this.scene.beginDirectAnimation(attacker, [finishAnim], 0, 18, false, 1, () => resolve());
    });

    // Animate each defender mesh dying in parallel
    const defenderDeaths = defenderEntries.map(({ mesh }) => this.animateCapture(mesh));

    await Promise.all([attackerFinish, ...defenderDeaths]);

    // Dispose defenders after animation
    defenderEntries.forEach(({ mesh, key }) => {
      mesh.dispose();
      this.pieceMeshes.delete(key);
    });
  }

  // Briefly shake a mesh in place (used for defender during strike).
  private shakeMesh(mesh: BABYLON.Mesh, durationMs: number, magnitude: number): Promise<void> {
    return new Promise(resolve => {
      const original = mesh.position.clone();
      const start = performance.now();
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        const elapsed = performance.now() - start;
        if (elapsed >= durationMs) {
          mesh.position.copyFrom(original);
          this.scene.onBeforeRenderObservable.remove(observer);
          resolve();
          return;
        }
        const decay = 1 - elapsed / durationMs;
        const dx = (Math.random() - 0.5) * magnitude * decay;
        const dz = (Math.random() - 0.5) * magnitude * decay;
        mesh.position.set(original.x + dx, original.y, original.z + dz);
      });
    });
  }

  // Briefly shake the active camera target for impact feedback.
  private shakeCamera(durationMs: number): void {
    const camera = this.scene.activeCamera as BABYLON.ArcRotateCamera | null;
    if (!camera || !(camera as any).target) return;
    const arc = camera as BABYLON.ArcRotateCamera;
    const originalTarget = arc.target.clone();
    const start = performance.now();
    const magnitude = 0.15;
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) {
        arc.setTarget(originalTarget);
        this.scene.onBeforeRenderObservable.remove(observer);
        return;
      }
      const decay = 1 - elapsed / durationMs;
      const dx = (Math.random() - 0.5) * magnitude * decay;
      const dy = (Math.random() - 0.5) * magnitude * decay * 0.5;
      const dz = (Math.random() - 0.5) * magnitude * decay;
      arc.setTarget(new BABYLON.Vector3(originalTarget.x + dx, originalTarget.y + dy, originalTarget.z + dz));
    });
  }

  // Remove a piece with capture animation: fade + sink + scale down + particle burst
  async removePiece(position: Position): Promise<void> {
    const targetMeshes: { mesh: BABYLON.Mesh; key: string }[] = [];

    this.pieceMeshes.forEach((mesh, key) => {
      const worldPos = boardToWorldPosition(position, BOARD_HEIGHT + SQUARE_SIZE * 0.2);
      if (Math.abs(mesh.position.x - worldPos.x) < 0.1 &&
          Math.abs(mesh.position.z - worldPos.z) < 0.1) {
        targetMeshes.push({ mesh, key });
      }
    });

    if (targetMeshes.length === 0) return;

    // Spawn particle burst at the capture location
    const captureWorld = boardToWorldPosition(position, BOARD_HEIGHT + SQUARE_SIZE * 0.4);
    this.createCaptureBurst(new BABYLON.Vector3(captureWorld.x, captureWorld.y, captureWorld.z));

    // Animate each captured mesh: fade + sink + scale down in parallel
    const animations = targetMeshes.map(({ mesh }) => this.animateCapture(mesh));
    await Promise.all(animations);

    // Dispose all captured meshes after animation completes
    targetMeshes.forEach(({ mesh, key }) => {
      mesh.dispose();
      this.pieceMeshes.delete(key);
    });
  }

  // Animate a single captured piece: sink down, scale to zero, fade out materials
  private animateCapture(mesh: BABYLON.Mesh): Promise<void> {
    const fps = 60;
    const totalFrames = 45; // 0.75 seconds
    const startPos = mesh.position.clone();
    const startScale = mesh.scaling.clone();

    // Sink animation (move down)
    const sinkAnim = new BABYLON.Animation(
      'captureSink', 'position', fps,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    sinkAnim.setKeys([
      { frame: 0, value: startPos },
      { frame: totalFrames, value: new BABYLON.Vector3(startPos.x, startPos.y - 1.0, startPos.z) },
    ]);

    // Scale down animation
    const scaleAnim = new BABYLON.Animation(
      'captureScale', 'scaling', fps,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    scaleAnim.setKeys([
      { frame: 0, value: startScale },
      { frame: totalFrames, value: BABYLON.Vector3.Zero() },
    ]);

    // Fade out materials (alpha)
    const allMeshes = [mesh, ...mesh.getChildMeshes()];
    allMeshes.forEach(m => {
      if (m.material) {
        // Clone material so we don't fade other pieces sharing it
        const clonedMat = m.material.clone(`fade-${m.name}`);
        if (clonedMat) {
          m.material = clonedMat;
          clonedMat.alpha = 1;
          if (clonedMat instanceof BABYLON.StandardMaterial) {
            clonedMat.useAlphaFromDiffuseTexture = false;
          }
          BABYLON.Animation.CreateAndStartAnimation(
            'captureFade', clonedMat, 'alpha', fps, totalFrames, 1, 0,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
          );
        }
      }
    });

    const ease = new BABYLON.QuadraticEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEIN);
    sinkAnim.setEasingFunction(ease);
    scaleAnim.setEasingFunction(ease);

    return new Promise(resolve => {
      this.scene.beginDirectAnimation(
        mesh,
        [sinkAnim, scaleAnim],
        0,
        totalFrames,
        false,
        1,
        () => resolve()
      );
    });
  }

  // Create a particle burst effect at the given position (sparks for capture)
  private createCaptureBurst(position: BABYLON.Vector3): void {
    const particleSystem = new BABYLON.ParticleSystem('captureBurst', 200, this.scene);

    // Use a built-in flare-like texture (white pixel works as fallback)
    particleSystem.particleTexture = new BABYLON.Texture(
      'data:image/svg+xml;base64,' + btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="white"/></svg>'
      ),
      this.scene
    );

    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, 0, -0.1);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0.2, 0.1);

    // Bright spark colors (orange/yellow)
    particleSystem.color1 = new BABYLON.Color4(1.0, 0.8, 0.2, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1.0, 0.4, 0.0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0.5, 0.1, 0.0, 0.0);

    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.2;

    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.8;

    particleSystem.emitRate = 800;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // Burst outward in all directions
    particleSystem.gravity = new BABYLON.Vector3(0, -3, 0);
    particleSystem.direction1 = new BABYLON.Vector3(-3, 5, -3);
    particleSystem.direction2 = new BABYLON.Vector3(3, 8, 3);

    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = Math.PI;

    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;
    particleSystem.updateSpeed = 0.01;

    // Burst: emit briefly then stop
    particleSystem.targetStopDuration = 0.15;
    particleSystem.disposeOnStop = true;

    particleSystem.start();
  }

  // Highlight a piece (apply yellow selectedMaterial). Tracks the mesh so deselect can revert it.
  selectPiece(position: Position): void {
    // First clear any previous selection
    this.deselectAll([]);

    const worldPos = boardToWorldPosition(position, BOARD_HEIGHT + SQUARE_SIZE * 0.2);

    this.pieceMeshes.forEach((mesh, key) => {
      if (Math.abs(mesh.position.x - worldPos.x) < 0.1 &&
          Math.abs(mesh.position.z - worldPos.z) < 0.1) {
        mesh.material = this.selectedMaterial;
        mesh.getChildMeshes().forEach(child => {
          child.material = this.selectedMaterial;
        });
        this.currentlySelectedMesh = mesh;
        // Color is encoded in the mesh's clone name: 'white-...' or 'black-...'
        this.currentlySelectedColor = key.startsWith('piece-white') ? 'white' : 'black';
      }
    });
  }

  // Deselect: restore the original color material on the previously selected mesh.
  // The `pieces` parameter is unused but kept for API compatibility.
  deselectAll(_pieces?: Piece[]): void {
    if (!this.currentlySelectedMesh || !this.currentlySelectedColor) return;
    const material = this.currentlySelectedColor === 'white' ? this.whiteMaterial : this.blackMaterial;
    this.currentlySelectedMesh.material = material;
    this.currentlySelectedMesh.getChildMeshes().forEach(child => {
      child.material = material;
    });
    this.currentlySelectedMesh = null;
    this.currentlySelectedColor = null;
  }

  // Sync mesh map keys with current piece positions. Called after a move so
  // future selectPiece/removePiece lookups don't fall through to creating new meshes.
  updateAllPieces(pieces: Piece[]): void {
    // Build the desired set of keys (one per current piece). Existing meshes whose
    // key matches stay put. Meshes that have been animated to a new square will
    // have their key updated; never create new meshes here (placePieces does that).
    const desiredKeys = new Set<string>();
    const keyForPiece = (p: Piece) =>
      `piece-${p.color}-${p.type}-${p.position.x}-${p.position.y}`;

    pieces.forEach(p => desiredKeys.add(keyForPiece(p)));

    // For each desired key, if there's no mesh under it, find an orphaned mesh
    // at that piece's world position and re-key it.
    pieces.forEach(piece => {
      const newKey = keyForPiece(piece);
      if (this.pieceMeshes.has(newKey)) return;

      const expectedHeight = BOARD_HEIGHT / 2 + SQUARE_SIZE * 0.3;
      const worldPos = boardToWorldPosition(piece.position, expectedHeight);

      for (const [oldKey, mesh] of this.pieceMeshes.entries()) {
        if (oldKey === newKey) continue;
        if (desiredKeys.has(oldKey)) continue; // owned by another piece
        if (Math.abs(mesh.position.x - worldPos.x) < 0.5 &&
            Math.abs(mesh.position.z - worldPos.z) < 0.5) {
          this.pieceMeshes.delete(oldKey);
          this.pieceMeshes.set(newKey, mesh);
          break;
        }
      }
    });
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
