# Spike: Team Battleship with Private Incentives
*Created: 2026-04-15*

## Concept

A 2v2 team variant of Battleship that introduces game-theoretic tension through private asymmetric scoring. Players must cooperate to win as a team, but compete individually for points.

## Rules

### Teams & Boards
- 2 teams of 2 players each.
- Each team shares a single 10x10 board with standard ship placement (Carrier-5, Battleship-4, Cruiser-3, Submarine-3, Destroyer-2).
- Both teammates can see their team's ships and all hits/misses on both boards.

### Turn Structure
- Round-robin: Team A P1 → Team B P1 → Team A P2 → Team B P2 → repeat.
- Each player fires one shot per turn.

### Scoring
- Each player is assigned private point values for each enemy ship at game start (randomly generated).
- When a player hits an enemy ship, they earn points based on their personal value for that ship.
- Point values are private — teammates cannot see each other's point assignments.
- Points are earned per hit, not just on sink (so a 5-cell Carrier hit 3 times by Player A = 3 × Player A's Carrier value).

### Win Condition
- A team wins by sinking all enemy ships (standard Battleship).
- No player on the losing team can win, regardless of individual score.
- The individual winner is the player on the winning team with the highest total points.

### Visibility
- Players see: their team's ships, all hits/misses on both boards, their own point values.
- Players don't see: opponent ship positions (until sunk/game over), teammate's point values.

## Strategic Dynamics

- **Target conflict:** Teammates may both want to target the same ship but can't reveal why.
- **Deduction:** Targeting patterns leak information about a player's private incentives.
- **Cooperation vs. competition:** Every shot on a low-personal-value target is a sacrifice for the team.
- **Free rider risk:** A player who only chases their high-value targets may neglect team-critical shots.

## Open Questions

- [x] Ship placement: collaborative. Both teammates place ships on the shared board in real time, seeing each other's placements live. Both must "lock in" before the game begins.
- [ ] Should point values be visible post-game for analysis?
- [ ] Chat/coordination between teammates (future feature).
- [ ] Should there be a "team score" in addition to individual scores?
- [ ] Scale to 4v4 — larger boards? More ships? Same board?
