# Battleship — Approach & Writeup

## Approach

I spent roughly an hour planning with Claude Code, loosely refining the plan before jumping into prototyping. My philosophy was to treat this as a **prototype** — prioritizing speed, exploration, and getting a working product over building a hardened production app. The goal was to learn fast and ship something playable.

The actual workflow split into two parallel tracks:

1. **Base game (agents):** I built the core 1v1 and vs-AI Battleship implementation using AI agents, then iterated after QA — testing in the browser, identifying gaps, and fixing them in tight loops.
2. **2v2 team mode (worktree):** In parallel, I developed the cooperative/competitive team concept on a separate git worktree, merging it in once it was stable.

This let me keep the main branch shippable while experimenting freely on the spike.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Monorepo** | pnpm workspaces | Shared types between client/server with zero config |
| **Frontend** | Next.js + React 19 + Tailwind CSS | Fast to scaffold, good DX, SSR-ready if needed |
| **State** | Zustand | Lightweight, no boilerplate, works well with socket events |
| **Server** | Express + Socket.IO | Real-time multiplayer needs WebSockets; Socket.IO handles reconnection/rooms |
| **Database** | SQLite (better-sqlite3) + Drizzle ORM | Zero-ops persistence — a single file, no external DB to manage. Perfect for a prototype |
| **Shared** | TypeScript workspace package | Single source of truth for game types, logic, and validation |

## Spike: Cooperative Game-Theoretic 2v2 Play

My spike introduces a **2v2 team Battleship mode** with a cooperative game-theoretic twist.

### The Core Tension

Each team shares a board and fires simultaneously — both teammates shoot each turn, blind to each other's targets. After a hit, you choose: **share the intel with your teammate, or keep it secret**.

- **Sharing** helps your team win (you avoid wasting duplicate shots on already-hit cells).
- **Keeping secrets** helps *you* individually — the winner is the player with the most hits on the winning team.

This creates a genuine strategic dilemma: cooperate fully and risk losing the individual race, or hoard information and risk your team losing entirely (in which case nobody on your team wins).

### Why This Is Interesting

- **Information asymmetry** drives real decisions — not just "where do I shoot?" but "what do I reveal?"
- **Wasted shots** punish selfish play — if your teammate secretly hit a cell and you fire there too, your shot is lost.
- **Deduction is possible** — watching your teammate's firing patterns can leak what they know (and what they're hiding).
- It transforms a solved, luck-heavy 2-player game into something with genuine strategic depth.

### Design Choices

- Team turns are simultaneous (both players fire at once) rather than round-robin, to make the information-hiding mechanic meaningful.
- Scoring is by hit count, not arbitrary point values — simple, transparent, and directly tied to gameplay contribution.
- Ships and boards are shared within a team with collaborative placement.

## Considerations

### Cheating Prevention

- Ship positions are **never sent to opponents** — the server is authoritative for all hit/miss resolution.
- In team mode, teammate views are tracked server-side per-player. The client only receives what that specific player is allowed to see.
- All game logic validation happens server-side; the client is a thin rendering layer.

### Scalability

- Board operations are O(1) lookups (coordinate-indexed). Scaling to larger boards is linear in board area, not exponential.
- The SQLite storage layer would be the first bottleneck at scale — for a production system, I'd move to Postgres with connection pooling.
- Socket.IO rooms naturally partition game state, so concurrent games don't interfere.

### What I'd Do to Harden This

If I were taking this to production, I'd go deeper on the prototype first — play more games, understand the architectural and efficiency pain points that emerge from real usage — then **rebuild iteratively**, reviewing at each phase. Specifically:

- **Testing:** Add integration tests for the game state machine and socket event flows. The prototype relies on manual QA.
- **Error handling:** More graceful recovery from disconnects mid-game, especially in team mode.
- **Auth:** Replace the cookie-based anonymous identity with proper authentication.
- **Deployment:** Move from SQLite to a managed database. Add health checks, monitoring, and structured logging.
- **UX polish:** Animations, sound, mobile responsiveness, spectator mode.
- **The spike:** Playtest the share-or-keep mechanic extensively and tune the incentives. The current design is a first pass — real games would reveal whether the tension is balanced or if one strategy dominates.
