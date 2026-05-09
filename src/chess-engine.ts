import { Chess } from 'chess.js';
import { Position, Piece, Move, GameStatus, PieceType } from './utils/types';
import { getInitialPieces, positionToNotation, notationToPosition } from './utils/constants';
import { findPieceAt, isSquareAttacked, getPiecesOfColor, getKingPosition } from './utils/helpers';

export class ChessEngine {
  private game: Chess;
  private pieces: Piece[];
  private moveHistory: Move[];

  constructor() {
    this.game = new Chess();
    this.pieces = getInitialPieces();
    this.moveHistory = [];
  }

  // Get all legal moves for a specific piece
  getLegalMovesForPiece(position: Position): Position[] {
    const piece = findPieceAt(this.pieces, position);
    if (!piece) return [];

    const notation = positionToNotation(position);
    const moves = this.game.moves({ square: notation, verbose: true });

    return moves
      .map(move => notationToPosition(move.to))
      .filter((pos): pos is Position => pos !== null);
  }

  // Get all legal moves in current position
  getAllLegalMoves(): Move[] {
    const moves = this.game.moves({ verbose: true });
    return moves.map(move => ({
      from: notationToPosition(move.from)!,
      to: notationToPosition(move.to)!,
      promotion: move.promotion ? (move.promotion.toUpperCase() as any) : undefined,
      timestamp: Date.now()
    }));
  }

  // Validate and make a move
  makeMove(from: Position, to: Position, promotion?: PieceType): boolean {
    const fromNotation = positionToNotation(from);
    const toNotation = positionToNotation(to);

    try {
      const moveObj = this.game.move({
        from: fromNotation,
        to: toNotation,
        promotion: promotion ? promotion.charAt(0).toLowerCase() : undefined
      });

      if (!moveObj) return false;

      // Update our piece array
      const piece = findPieceAt(this.pieces, from);
      if (piece) {
        const capturedPiece = findPieceAt(this.pieces, to);
        if (capturedPiece) {
          this.pieces = this.pieces.filter(p => p !== capturedPiece);
        }

        piece.position = to;
        piece.hasMoved = true;

        if (promotion) {
          piece.type = promotion;
        }

        const move: Move = {
          from,
          to,
          capturedPiece,
          promotion,
          timestamp: Date.now()
        };

        this.moveHistory.push(move);
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  // Undo last move
  undoMove(): Move | null {
    const move = this.moveHistory.pop();
    if (!move) return null;

    this.game.undo();

    // Restore piece state
    const piece = findPieceAt(this.pieces, move.to);
    if (piece) {
      piece.position = move.from;

      // Restore captured piece if any
      if (move.capturedPiece) {
        this.pieces.push(move.capturedPiece);
      }

      // Restore promoted piece to pawn
      if (move.promotion) {
        piece.type = PieceType.Pawn;
      }

      // Mark piece as not moved if this was its first move
      if (this.moveHistory.filter(m => m.from === move.from || m.to === move.from).length === 0) {
        piece.hasMoved = false;
      }
    }

    return move;
  }

  // Get game status
  getGameStatus(): GameStatus {
    if (this.game.isCheckmate()) {
      return GameStatus.Checkmate;
    }
    if (this.game.isStalemate()) {
      return GameStatus.Stalemate;
    }
    if (this.game.isDraw()) {
      return GameStatus.Draw;
    }
    if (this.game.isCheck()) {
      return GameStatus.Check;
    }
    return GameStatus.InProgress;
  }

  // Check if king is in check
  isInCheck(): boolean {
    return this.game.isCheck();
  }

  // Check if it's checkmate
  isCheckmate(): boolean {
    return this.game.isCheckmate();
  }

  // Check if it's stalemate
  isStalemate(): boolean {
    return this.game.isStalemate();
  }

  // Get current player color
  getCurrentPlayer(): 'white' | 'black' {
    return this.game.turn() === 'w' ? 'white' : 'black';
  }

  // Get FEN string
  getFEN(): string {
    return this.game.fen();
  }

  // Load from FEN
  loadFromFEN(fen: string): boolean {
    try {
      this.game.load(fen);
      this.pieces = getInitialPieces();
      this.moveHistory = [];
      return true;
    } catch (e) {
      return false;
    }
  }

  // Reset to starting position
  reset(): void {
    this.game.reset();
    this.pieces = getInitialPieces();
    this.moveHistory = [];
  }

  // Get move count
  getMoveCount(): number {
    return this.moveHistory.length;
  }

  // Get move history
  getMoveHistory(): Move[] {
    return [...this.moveHistory];
  }

  // Get current pieces
  getPieces(): Piece[] {
    return [...this.pieces];
  }

  // Get piece at position
  getPieceAt(position: Position): Piece | undefined {
    return findPieceAt(this.pieces, position);
  }
}
