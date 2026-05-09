# ♟ 3D Chess Game - Dune Edition

## Opis

Gra szachowa w 3D z GPU-accelerated grafiką przy użyciu **Babylon.js**. Figurki stylizowane na postacie z universum Dune:
- **Białe (Atreides):** Fremen
- **Czarne (Imperium):** Sardaukar

## Stack Techniczny

- **3D Engine:** Babylon.js 6.0+
- **Język:** TypeScript
- **Build Tool:** esbuild
- **Chess Logic:** chess.js
- **Physics:** Babylon.js Physics (Cannon.js)

## Instalacja

```bash
# Zainstaluj zależności
npm install

# Zbuduj projekt
npm run build

# Uruchom dev server
npm run dev
```

## Struktura Projektu

```
3DimensionalChess/
├── src/
│   ├── game-engine.ts       # Główny silnik gry
│   ├── board-renderer.ts    # Rendering planszy 3D
│   ├── piece-renderer.ts    # Rendering figurek
│   ├── chess-engine.ts      # Logika szachów
│   ├── input-handler.ts     # Obsługa input'u (kliknięcia)
│   ├── main.ts              # Punkt wejścia
│   └── utils/
│       ├── types.ts         # TypeScript types
│       ├── constants.ts     # Stałe gry
│       └── helpers.ts       # Funkcje pomocnicze
├── assets/
│   ├── models/
│   │   ├── sardaukar.glb    # Model Sardaukar (czarne)
│   │   └── fremen_of_dune.glb # Model Fremen (białe)
│   ├── textures/            # Tekstury (plansze)
│   └── sounds/              # Efekty dźwiękowe
├── index.html               # HTML container
└── package.json             # Dependencje
```

## Jak Grać

1. Otwórz `http://localhost:8080` w przeglądarce
2. Kliknij na figurkę aby ją wybrać (pokaże się podświetlenie możliwych ruchów)
3. Kliknij na podświetlone pole aby wykonać ruch
4. Gra się zmienia między graczami (białe = Fremen/Atreides, czarne = Sardaukar)

## Kontrolki

- **Lewy Click:** Wybierz figurkę / Wykonaj ruch
- **ESC:** Anuluj wybór

## Status Implementacji

### ✅ Phase 1 (MVP) - Kompletne
- [x] Rendering planszy 3D
- [x] Ładowanie modeli 3D (Fremen + Sardaukar)
- [x] Placement figurek w pozycji startowej
- [x] Obsługa input'u (kliknięcia)
- [x] Walidacja ruchów (chess.js)
- [x] Zmiana gracza
- [x] Detencja check/checkmate/stalemate
- [x] Animacja ruchów figurek
- [x] UI status gry

### 🔄 Phase 2 (Graphics) - Planowane
- [ ] Smooth animacje
- [ ] Particle effects (capture effect)
- [ ] Post-processing (bloom, depth-of-field)
- [ ] 3-point lighting improvements
- [ ] Real-time shadows
- [ ] Camera controls (orbit, zoom)

### 🔄 Phase 3 (AI) - Planowane
- [ ] AI opponent (Stockfish.js)
- [ ] Difficulty levels
- [ ] AI thinking animation

### 🔄 Phase 4 (Polish) - Planowane
- [ ] Sound effects
- [ ] Move history panel
- [ ] Save/load games
- [ ] Settings menu

## Debug Console

Po uruchomieniu gry dostępny jest obiekt `gameEngine` w konsoli:

```javascript
// Resetuj grę
gameEngine.resetGame()

// Cofnij ostatni ruch
gameEngine.undoMove()

// Pokaż stan gry
console.log(gameEngine.getGameState())
```

## Wymagania Systemowe

- Modern browser z WebGL support (Chrome 90+, Firefox 88+, Safari 14+)
- ~50MB RAM dla gry
- Internet connection do pobrania Babylon.js

## TODO na Przyszłość

- [ ] Zoptymalizować rozmiar bundla (obecnie ~11MB)
- [ ] Dodać WebGPU support
- [ ] Multiplayer via WebSockets
- [ ] Mobile touch controls
- [ ] Dark mode UI
- [ ] Replay system
- [ ] Analytics dashboard

## Licencja

MIT

## Credits

- 3D Models: Sketchfab (Sardaukar by ptibogvader, Fremen by ...)
- Chess Logic: chess.js
- 3D Engine: Babylon.js
- Inspiracja: Frank Herbert's Dune
