# Plan: Redesign Team Mode — Information Sharing Mechanic

## Context

The initial team mode implementation used private point values and round-robin individual turns. The user wants a fundamentally different mechanic:

- **Team-based turns** (both players fire simultaneously), not individual round-robin
- **Private enemy board views** — each player only sees their own hits + hits their teammate chose to share
- **Share-or-keep mechanic** — after a hit, player chooses whether to reveal it to teammate
- **Wasted duplicate shots** — hitting a cell your teammate already (secretly) hit is wasted
- **Hit-count scoring** — winner = most unique hits on winning team (not points)
- **Reveal rules** — hitting an already-hit cell shows it was hit; hitting an already-sunk ship reveals the whole ship

No changes needed to: lobby, placement, or DB schema. The redesign is focused on the **firing loop**, **state model**, **types**, and **battle UI**.

---

## New Turn Flow

```
1. Team A's turn begins
2. Both Team A players see "Your team's turn — fire!"
3. Both players click a cell on their PRIVATE view of the enemy board
4. Server waits for BOTH shots (simultaneously, blind to each other)
5. Server processes both shots against the TRUE enemy board:
   - If the cell was already hit (by teammate in a previous round): WASTED
   - Otherwise: normal hit/miss/sunk check
6. Server sends each player their result
7. For each player who got a NEW hit: prompt "Share with teammate?"
8. Server waits for share decisions from players who got hits
9. Apply share decisions — update teammate's private view if shared
10. Check win condition (all enemy ships sunk on the TRUE board)
11. Advance to Team B's turn
```

## 1. Type Changes (`shared/src/types.ts`)

### Remove
- `ShipPointValues` type
- `generatePointValues` from `shared/src/logic.ts`

### Modify `TeamPlayerState`
```ts
type TeamPlayerState = {
  ready: boolean;
  hitCount: number;           // unique hits scored (for win tiebreak)
};
```

### Modify `TeamGameState`
```ts
type TeamGameState = {
  teams: Record<TeamId, { playerIds: string[] }>;
  boards: Record<TeamId, PlayerBoard>;                    // TRUE state (server authoritative)
  playerViews: Record<string, PlayerBoard>;               // per-player PRIVATE view of enemy board
  players: Record<string, TeamPlayerState>;
  placementShips: Record<TeamId, ShipPlacement[]>;
  currentTeamTurn: TeamId;                                // which team fires next
  turnPhase: "firing" | "sharing" | "waiting";            // sub-phase within a team turn
  pendingShots: Record<string, { x: number; y: number } | null>;  // shots submitted this turn (null = not yet fired)
  pendingResults: Record<string, TeamShotResult | null>;  // results awaiting share decision
};
```

### New `TeamShotResult` type
```ts
type TeamShotResult = {
  coordinate: Coordinate;
  result: "hit" | "miss" | "sunk" | "wasted";   // "wasted" = cell already hit
  shipType?: ShipType;
  sunkShip?: ShipPlacement;
  alreadyHitBy?: string;     // userId who previously hit this cell (for wasted shots)
  revealedSunkShip?: ShipPlacement;  // if hitting an already-sunk ship, reveal it
};
```

### Socket Event Changes

**Remove:** `team_fire_result`, `team_turn_update` (replace with new events below)

**New Client→Server:**
- `team_fire`: `(data: { x: number; y: number }) => void` — player submits their shot
- `team_share_decision`: `(data: { share: boolean }) => void` — player decides to share or keep hit

**New Server→Client:**
- `team_turn_start`: `(data: { currentTeamTurn: TeamId }) => void` — signals whose team's turn
- `team_shot_result`: `(data: TeamShotResult & { phase: "share_prompt" | "done" }) => void` — your shot result; if `phase === "share_prompt"` you must respond
- `team_waiting_for_teammate`: `() => void` — you fired, waiting for teammate
- `team_teammate_shot_done`: `() => void` — teammate has fired (no details yet)
- `team_share_received`: `(data: { coordinate: Coordinate; result: "hit" | "sunk"; shipType?: ShipType; sunkShip?: ShipPlacement }) => void` — teammate shared a hit with you
- `team_round_complete`: `(data: { nextTeamTurn: TeamId }) => void` — both shots + sharing done, next team's turn
- `team_opponent_turn_result`: `(data: { hitsOnYourBoard: Coordinate[]; missesOnYourBoard: Coordinate[]; sunkShips: ShipPlacement[] }) => void` — after enemy team fires, show what hit your team's board
- Keep `team_game_over` but change payload: `{ winningTeam: TeamId; hitCounts: Record<string, number>; mvp: string }`
- Keep `team_both_ready` but remove `yourPointValues` field

## 2. Server State Machine (`server/src/game/state.ts`)

### Remove
- `generatePointValues()` from `shared/src/logic.ts`
- `advanceTurn()` — no longer individual turn cycling
- `getCurrentTurnUserId()` — turns are team-based now
- Point value fields from `createTeamInitialState`

### Modify `createTeamInitialState`
- Initialize `playerViews` — each player gets an empty board view of the enemy
- Set `currentTeamTurn: "teamA"`
- Set `turnPhase: "waiting"`
- Set `pendingShots: {}` and `pendingResults: {}`
- `TeamPlayerState` gets `hitCount: 0` instead of `pointValues`/`score`

### New functions
- `advanceTeamTurn(teamState): TeamGameState` — toggle `currentTeamTurn` between teamA/teamB
- `bothPlayersHaveFired(teamState): boolean` — check if both players on current team submitted shots
- `getPlayersNeedingShareDecision(teamState): string[]` — returns player IDs who got hits and haven't shared/kept yet

## 3. Server Firing Handler (`server/src/socket/team-firing.ts`)

Complete rewrite. The handler manages a **multi-phase turn**:

### `team_fire` handler
1. Validate: game in progress, it's this player's team's turn, phase is "firing", player hasn't already shot this turn
2. Record the shot in `pendingShots[userId]`
3. If teammate hasn't fired yet: emit `team_waiting_for_teammate` to this player, `team_teammate_shot_done` is NOT sent yet
4. If BOTH have fired: process both shots:
   - For each shot, check against TRUE enemy board:
     - If cell already in `boards[enemyTeam].hits`: result is `"wasted"`, check if the ship at that cell is already sunk → if so, set `revealedSunkShip`
     - Otherwise: normal `checkShot()` + `applyShot()` on TRUE board
   - If result is a new hit: increment `player.hitCount`, set `turnPhase: "sharing"`
   - Send `team_shot_result` to each player with their result
   - Also send `team_teammate_shot_done` to the player who fired first
   - If no hits from either player: skip sharing phase, go straight to round complete
5. Persist state

### `team_share_decision` handler
1. Validate: phase is "sharing", this player has a pending hit result
2. Record decision
3. If `share === true`: update teammate's `playerViews[teammateId]` with the hit coordinate (add to hits array). If it was a sunk result, add the sunk ship to teammate's view. Emit `team_share_received` to teammate.
4. Check if all players needing share decisions have responded
5. If all done:
   - Check win condition on TRUE board
   - If win: emit `team_game_over`
   - Otherwise: emit `team_opponent_turn_result` to the enemy team (showing what hit their board this turn), then `team_round_complete` to all, advance turn
6. Persist state

### Enemy team notification
After a team's turn completes, the OTHER team needs to see what happened to their board. Emit `team_opponent_turn_result` with the coordinates that hit/missed their board this round (but NOT who fired — just that hits landed).

## 4. Server Placement Handler (`server/src/socket/team-placement.ts`)

### Modify `team_lock_in` → `team_both_ready` emission
Remove `yourPointValues` from the payload. Add `currentTeamTurn: "teamA"` instead.

## 5. Frontend Store (`client/src/store/game-store.ts`)

### Remove
- `yourScore`, `yourPointValues` state fields
- Point-related listeners

### Modify state
```ts
// Replace enemyTeamBoard with per-player private view
myEnemyView: PlayerBoard;         // YOUR private view of enemy board (your hits + shared hits)
hitCount: number;                  // your hit count
sharePromptResult: TeamShotResult | null;  // non-null when awaiting share decision
waitingForTeammate: boolean;
currentTeamTurn: TeamId | null;
```

### New actions
- `teamFire: (coord: Coordinate) => void` — emits `team_fire`
- `teamShareDecision: (share: boolean) => void` — emits `team_share_decision`

### Modified listeners
- `team_both_ready` — no longer receives point values
- `team_turn_start` — set `currentTeamTurn`, `isYourTurn` based on team
- `team_shot_result` — show result, if `phase === "share_prompt"` set `sharePromptResult`
- `team_waiting_for_teammate` — set `waitingForTeammate: true`
- `team_share_received` — merge shared hit into `myEnemyView`
- `team_round_complete` — advance turn state
- `team_opponent_turn_result` — update `teamBoard` with incoming hits
- `team_game_over` — show hit counts instead of scores

## 6. Frontend Battle View (`client/src/components/battle/TeamBattleView.tsx`)

### Replace point values sidebar with hit count display
- Show "Your Hits: X" instead of score/point values

### Turn indicator
- Show team-level turns: "Team A's Turn" / "Team B's Turn" (not individual)

### Firing flow
- When it's your team's turn and phase is firing: enemy board is interactive
- After you fire: show "Waiting for teammate..." until both have fired
- After both fire: show your result

### Share prompt overlay
- When `sharePromptResult` is non-null, show a modal/overlay:
  - "You hit the [ShipType]! Share with teammate?"
  - [Share] [Keep Secret] buttons
  - Calls `teamShareDecision(true/false)`

### Wasted shot display
- If result is `"wasted"`: highlight the cell differently (e.g., yellow outline)
- If `revealedSunkShip`: add the sunk ship to your private view

### Board rendering
- Use `myEnemyView` (not a shared enemy board) for the enemy grid
- Team board uses `teamBoard` as before

## 7. Frontend Game Over View (`client/src/components/game-over/TeamGameOverView.tsx`)

### Change from scores to hit counts
- Show "Hits: X" per player instead of "Xpts"
- MVP = most hits on winning team

## 8. Implementation Order

| Step | What |
|---|---|
| 1 | Update shared types (remove ShipPointValues, add TeamShotResult, modify TeamGameState/TeamPlayerState, update socket events) |
| 2 | Update server state functions (remove point stuff, add new turn helpers) |
| 3 | Rewrite team-firing.ts (multi-phase turn: fire → share → complete) |
| 4 | Update team-placement.ts (remove point values from team_both_ready) |
| 5 | Update frontend store (new state fields, actions, listeners) |
| 6 | Rewrite TeamBattleView (private board view, share prompt, hit count) |
| 7 | Update TeamGameOverView (hit counts instead of scores) |

## 9. Verification

- 4 browser tabs, create team game, join, place ships
- Team A's turn: both players fire simultaneously (neither sees the other's shot)
- Player who hits gets share prompt; player who misses does not
- Sharing a hit → teammate sees it on their view; keeping → they don't
- Firing at a cell teammate already hit (and didn't share) → "wasted" result + cell highlighted
- Hitting an already-sunk ship → entire ship revealed on your view
- Game ends when all ships on one side sunk on the TRUE board
- Winner = most hits on winning team
- Existing modes unaffected

## Key Files to Modify

| File | Change |
|---|---|
| `shared/src/types.ts` | Remove ShipPointValues, modify TeamGameState/TeamPlayerState, add TeamShotResult, update socket events |
| `shared/src/logic.ts` | Remove `generatePointValues()` |
| `server/src/game/state.ts` | Remove point functions, add `advanceTeamTurn`, `bothPlayersHaveFired`, `getPlayersNeedingShareDecision` |
| `server/src/socket/team-firing.ts` | Full rewrite for multi-phase team turns |
| `server/src/socket/team-placement.ts` | Remove point values from team_both_ready |
| `client/src/store/game-store.ts` | Replace score/point state with hit count, add share prompt state, new listeners |
| `client/src/components/battle/TeamBattleView.tsx` | Private board view, share prompt overlay, hit count sidebar |
| `client/src/components/game-over/TeamGameOverView.tsx` | Hit counts instead of scores |
