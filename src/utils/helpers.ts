import { Position, Piece, PieceType } from './types';
import { BOARD_SIZE, SQUARE_SIZE } from './constants';

// Convert board position (0-7) to 3D world position
export function boardToWorldPosition(pos: Position, height: number = 0): {
  x: number;
  y: number;
  z: number;
} {
  const x = pos.x * SQUARE_SIZE - (BOARD_SIZE * SQUARE_SIZE) / 2 + SQUARE_SIZE / 2;
  // White (y=0) at +3.5 (towards camera), black (y=7) at -3.5 (away from camera)
  const z = (7 - pos.y) * SQUARE_SIZE - (BOARD_SIZE * SQUARE_SIZE) / 2 + SQUARE_SIZE / 2;
  return { x, y: height, z };
}

// Check if position is within board bounds
export function isInBounds(pos: Position): boolean {
  return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
}

// Find piece at specific position
export function findPieceAt(pieces: Piece[], pos: Position): Piece | undefined {
  return pieces.find(p => p.position.x === pos.x && p.position.y === pos.y);
}

// Check if path is clear between two positions (for sliding pieces)
export function isPathClear(
  from: Position,
  to: Position,
  pieces: Piece[]
): boolean {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);

  let current = { x: from.x + dx, y: from.y + dy };

  while (current.x !== to.x || current.y !== to.y) {
    if (findPieceAt(pieces, current)) {
      return false;
    }
    current.x += dx;
    current.y += dy;
  }

  return true;
}

// Calculate distance between two positions
export function distance(from: Position, to: Position): number {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
}

// Get all pieces of a specific color
export function getPiecesOfColor(pieces: Piece[], color: string): Piece[] {
  return pieces.filter(p => p.color === color);
}

// Get king position
export function getKingPosition(pieces: Piece[], color: string): Position | null {
  const king = pieces.find(p => p.type === PieceType.King && p.color === color);
  return king ? king.position : null;
}

// Check if square is attacked by opponent
export function isSquareAttacked(
  square: Position,
  byColor: string,
  pieces: Piece[]
): boolean {
  const attackingPieces = getPiecesOfColor(pieces, byColor);

  for (const piece of attackingPieces) {
    if (canPieceMoveTo(piece, square, pieces)) {
      return true;
    }
  }

  return false;
}

// Determine if a piece can theoretically move to a position (without king safety check)
export function canPieceMoveTo(
  piece: Piece,
  target: Position,
  pieces: Piece[]
): boolean {
  if (piece.position.x === target.x && piece.position.y === target.y) {
    return false;
  }

  const targetPiece = findPieceAt(pieces, target);
  if (targetPiece && targetPiece.color === piece.color) {
    return false; // Can't capture own piece
  }

  const dx = Math.abs(target.x - piece.position.x);
  const dy = Math.abs(target.y - piece.position.y);

  switch (piece.type) {
    case PieceType.Pawn:
      return canPawnMoveTo(piece, target, pieces);

    case PieceType.Knight:
      return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);

    case PieceType.Bishop:
      if (dx !== dy) return false;
      return isPathClear(piece.position, target, pieces);

    case PieceType.Rook:
      if (piece.position.x !== target.x && piece.position.y !== target.y) {
        return false;
      }
      return isPathClear(piece.position, target, pieces);

    case PieceType.Queen:
      if (
        piece.position.x !== target.x &&
        piece.position.y !== target.y &&
        dx !== dy
      ) {
        return false;
      }
      return isPathClear(piece.position, target, pieces);

    case PieceType.King:
      return dx <= 1 && dy <= 1;

    default:
      return false;
  }
}

// Pawn-specific movement rules
function canPawnMoveTo(
  pawn: Piece,
  target: Position,
  pieces: Piece[]
): boolean {
  const direction = pawn.color === 'white' ? 1 : -1;
  const startRow = pawn.color === 'white' ? 1 : 6;
  const dx = target.x - pawn.position.x;
  const dy = target.y - pawn.position.y;

  // Move forward one square
  if (dx === 0 && dy === direction) {
    return !findPieceAt(pieces, target);
  }

  // Move forward two squares from starting position
  if (
    dx === 0 &&
    dy === 2 * direction &&
    pawn.position.y === startRow &&
    !findPieceAt(pieces, target)
  ) {
    const intermediary = { x: pawn.position.x, y: pawn.position.y + direction };
    return !findPieceAt(pieces, intermediary);
  }

  // Capture diagonally
  if (Math.abs(dx) === 1 && dy === direction) {
    return !!findPieceAt(pieces, target);
  }

  return false;
}
