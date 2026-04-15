# Battleship - Architecture
*Created: 2026-04-15*

## Stack

- **Language:** TypeScript (end-to-end)
- **Frontend:** Next.js + React + Tailwind CSS
- **Backend:** Express + Socket.IO
- **ORM:** Drizzle
- **Database:** SQLite
- **Deployment:** Vercel (frontend), Railway (backend)

## Monorepo Structure

```
/
├── client/          # Next.js frontend
├── server/          # Express + Socket.IO game server
└── shared/          # Shared TypeScript types (game state, events, etc.)
```

## Game State

- All active game state persisted to SQLite via Drizzle (survives page refresh and server restart).
- Completed games stored with full move history, outcome, and timestamps for querying.

## Real-Time Communication

- Socket.IO for all real-time game events (ship placement, firing, turn updates, game over).
- REST endpoints for non-realtime operations (game history queries, creating/joining lobbies).

## Client-Side State

- **Zustand** for all client-side game state.
- Socket.IO event handlers call `store.getState()` / `store.setState()` directly — no React wiring needed.
- Components subscribe to slices of state to minimize re-renders.

## Anti-Cheat

- Server is the single source of truth. Clients send actions (place ships, fire); server validates and responds.
- Ship positions are never sent to the opponent's client.
- All game logic (hit detection, sinking, win condition) runs server-side.

## AI Opponent

- Runs server-side.
- Hunt/target algorithm: random shots until a hit, then probes adjacent cells systematically.

## Game Modes

1. **vs. AI (single-player):** AI ships placed randomly, AI shot logic server-side.
2. **vs. Human (multiplayer):** Two players in separate browser windows, real-time via Socket.IO rooms.

## Data Model

Hybrid approach: relational tables for persistent entities, JSON `state` column for active game state. This avoids expensive joins to reconstruct game state on every action while keeping queryable metadata.

### `user`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| display_name | text | User-chosen name |
| session_token | text | Stored in cookie, used for auth/reconnection |
| created_at | timestamp | |

### `game`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| mode | text | `'ai' \| 'multiplayer'` |
| status | text | `'waiting' \| 'placing_ships' \| 'in_progress' \| 'completed'` |
| user1_id | uuid | FK → user |
| user2_id | uuid | FK → user (null if AI or waiting) |
| winner_id | uuid | FK → user (null until completed) |
| state | json | Full active game state (see schema below) |
| created_at | timestamp | |
| updated_at | timestamp | |

### `move`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| game_id | uuid | FK → game |
| user_id | uuid | FK → user (who fired) |
| x | integer | |
| y | integer | |
| result | text | `'hit' \| 'miss' \| 'sunk'` |
| created_at | timestamp | |

### `game.state` JSON Schema
```typescript
{
  currentTurn: string,              // userId of whose turn it is
  players: {
    [userId: string]: {
      ships: [
        { type: ShipType, startX: number, startY: number, orientation: 'horizontal' | 'vertical' },
        // ... 5 ships per player
      ],
      shipsPlaced: boolean,
    }
  },
  boards: {
    [userId: string]: {             // keyed by the board owner (defender)
      hits: [{ x: number, y: number }],
      misses: [{ x: number, y: number }],
    }
  }
}
```
- Hits/misses stored per-board (defender's perspective) — to render, check your board for incoming damage, opponent's board for your shots.
- Sunk status is derived: a ship is sunk when all its cells appear in the hits array.
- `move` table is the ordered history log; `state` JSON is the current snapshot for fast reads.

### Notes
- `game.state` JSON holds ships, boards, and current turn — one read/write per action.
- `move` table is an append-only log for game history and replay.
- Users are session-based (cookie) — no login/password required.
- A user can view all their past games via `user1_id` / `user2_id` queries.

## Socket.IO Events

### Lobby / Connection
| Direction | Event | Payload | Notes |
|---|---|---|---|
| C → S | `create_game` | `{ mode }` | Creates game, joins Socket.IO room |
| C → S | `join_game` | `{ gameId }` | Join existing multiplayer game |
| C → S | `reconnect_game` | `{ gameId }` | Rejoin after refresh (auth via session token) |
| S → C | `game_created` | `{ gameId }` | Confirm creation, shareable ID for multiplayer |
| S → C | `opponent_joined` | `{ opponentName }` | Multiplayer: player 2 connected |
| S → C | `error` | `{ message }` | Validation errors, invalid actions |

### Ship Placement
| Direction | Event | Payload | Notes |
|---|---|---|---|
| C → S | `place_ships` | `{ ships: [{ type, startX, startY, orientation }] }` | All 5 ships at once, server validates |
| S → C | `ships_accepted` | `{}` | Placement valid |
| S → C | `both_ready` | `{ currentTurn }` | Both players placed, game begins |

### Firing
| Direction | Event | Payload | Notes |
|---|---|---|---|
| C → S | `fire` | `{ x, y }` | Player's shot |
| S → C | `fire_result` | `{ x, y, result, shipType?, gameOver? }` | Sent to the shooter |
| S → C | `opponent_fired` | `{ x, y, result, shipType?, gameOver? }` | Sent to the opponent |

### Game Over
| Direction | Event | Payload | Notes |
|---|---|---|---|
| S → C | `game_over` | `{ winnerId, opponentShips }` | Reveal opponent's board |
| C → S | `rematch` | `{ gameId }` | Request new game with same opponent |
| S → C | `rematch_requested` | `{}` | Notify opponent of rematch request |
| S → C | `rematch_created` | `{ gameId }` | Both agreed, new game started |

### Design Decisions
- `place_ships` sends all 5 at once — simpler server validation, one round trip.
- `fire_result` and `opponent_fired` are separate events so the server controls what each player sees (anti-cheat).
- `shipType` only included on `sunk` results so the client can announce which ship was sunk.
- Opponent's full ship layout only revealed in `game_over`.

## Lobby Flow

1. User visits site → session cookie assigned → `user` row created if new.
2. **Main menu:** vs AI | Create Game | Join Game | Game History.
3. **Create Game (multiplayer):**
   - Server creates game in `waiting` status, generates a 4-character code.
   - User sees "Share this code: XKDF" and waits on a lobby screen.
   - Socket.IO room created for the game.
4. **Join Game (multiplayer):**
   - User enters code → server validates, adds them as `user2_id`.
   - Both clients receive `opponent_joined` → transition to ship placement phase.
5. **vs AI:**
   - Server creates game, AI is `user2_id` (no `user` row, flagged in game state).
   - Skips waiting → straight to ship placement.
   - AI places ships randomly server-side.
6. **Reconnection:**
   - On page refresh, client sends `reconnect_game` with `gameId` from URL.
   - Server authenticates via session cookie, restores client to correct game phase.

## URL Structure

| Route | Purpose |
|---|---|
| `/` | Main menu (vs AI, Create Game, Join Game, History) |
| `/game/:id` | Game view — all phases (waiting, placement, firing, game over) rendered based on game state |
| `/history` | List of user's past games |
| `/history/:id` | Completed game detail / replay |

- `/game/:id` uses the game UUID, not the 4-character lobby code.
- Single route handles all game phases — UI swaps based on status from the Zustand store.
- Game ID in URL enables reconnection on refresh.
