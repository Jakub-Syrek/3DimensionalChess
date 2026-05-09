// Board position (0-7 for both x and y, representing a1-h8)
export type Position = {
  x: number;
  y: number;
};

export type Color = 'white' | 'black';

export enum PieceType {
  Pawn = 'pawn',
  Knight = 'knight',
  Bishop = 'bishop',
  Rook = 'rook',
  Queen = 'queen',
  King = 'king'
}

export interface Piece {
  type: PieceType;
  color: Color;
  position: Position;
  hasMoved?: boolean; // For castling/pawn double-move rules
}

export interface Move {
  from: Position;
  to: Position;
  capturedPiece?: Piece;
  promotion?: PieceType;
  timestamp: number;
}

export enum GameStatus {
  InProgress = 'in-progress',
  Check = 'check',
  Checkmate = 'checkmate',
  Stalemate = 'stalemate',
  Draw = 'draw'
}

export interface GameState {
  pieces: Piece[];
  currentPlayer: Color;
  moveHistory: Move[];
  status: GameStatus;
  selectedPiece: Position | null;
  legalMoves: Position[];
}

export interface HighlightSquare {
  position: Position;
  type: 'legal' | 'selected' | 'last-move';
  color: string;
}
