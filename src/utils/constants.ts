import { Piece, PieceType, Color, Position } from './types';

export const BOARD_SIZE = 8;
export const SQUARE_SIZE = 1.0;
export const BOARD_HEIGHT = 0.2;

// Colors for UI elements
export const HIGHLIGHT_COLOR_LEGAL = '#90EE90'; // Light green
export const HIGHLIGHT_COLOR_SELECTED = '#FFD700'; // Gold
export const HIGHLIGHT_COLOR_LAST_MOVE = '#87CEEB'; // Sky blue

// Camera configuration
export const CAMERA_DISTANCE = 12;
export const CAMERA_ANGLE = Math.PI / 6; // 30 degrees

// Initial piece setup (standard chess starting position)
export function getInitialPieces(): Piece[] {
  const pieces: Piece[] = [];

  // Black pieces (top of board, y=7)
  const blackPieces: [PieceType, Position][] = [
    [PieceType.Rook, { x: 0, y: 7 }],
    [PieceType.Knight, { x: 1, y: 7 }],
    [PieceType.Bishop, { x: 2, y: 7 }],
    [PieceType.Queen, { x: 3, y: 7 }],
    [PieceType.King, { x: 4, y: 7 }],
    [PieceType.Bishop, { x: 5, y: 7 }],
    [PieceType.Knight, { x: 6, y: 7 }],
    [PieceType.Rook, { x: 7, y: 7 }]
  ];

  blackPieces.forEach(([type, pos]) => {
    pieces.push({ type, color: 'black', position: pos, hasMoved: false });
  });

  // Black pawns
  for (let x = 0; x < 8; x++) {
    pieces.push({
      type: PieceType.Pawn,
      color: 'black',
      position: { x, y: 6 },
      hasMoved: false
    });
  }

  // White pawns
  for (let x = 0; x < 8; x++) {
    pieces.push({
      type: PieceType.Pawn,
      color: 'white',
      position: { x, y: 1 },
      hasMoved: false
    });
  }

  // White pieces (bottom of board, y=0)
  const whitePieces: [PieceType, Position][] = [
    [PieceType.Rook, { x: 0, y: 0 }],
    [PieceType.Knight, { x: 1, y: 0 }],
    [PieceType.Bishop, { x: 2, y: 0 }],
    [PieceType.Queen, { x: 3, y: 0 }],
    [PieceType.King, { x: 4, y: 0 }],
    [PieceType.Bishop, { x: 5, y: 0 }],
    [PieceType.Knight, { x: 6, y: 0 }],
    [PieceType.Rook, { x: 7, y: 0 }]
  ];

  whitePieces.forEach(([type, pos]) => {
    pieces.push({ type, color: 'white', position: pos, hasMoved: false });
  });

  return pieces;
}

// File/rank notation helper (for debugging/logging)
export function positionToNotation(pos: Position): string {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return files[pos.x] + (pos.y + 1);
}

export function notationToPosition(notation: string): Position | null {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const file = files.indexOf(notation[0]);
  const rank = parseInt(notation[1]) - 1;

  if (file < 0 || rank < 0 || rank >= 8) return null;
  return { x: file, y: rank };
}
