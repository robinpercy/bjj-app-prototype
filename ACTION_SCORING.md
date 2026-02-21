# Action Evaluation & Scoring Logic

## Overview

Each turn both players independently choose a **category** and a **technique**. The game resolves the exchange by computing a score for each side, comparing them, and applying effects based on the margin of victory.

---

## 1. Action Categories & Matchups

Four categories form a rock-paper-scissors loop:

| Category | Icon | Beats | Loses to |
|----------|------|-------|----------|
| Attack | ⚔️ | Defense | Sweep |
| Control | 🤝 | Sweep | Defense |
| Defense | 🛡️ | Control | Attack |
| Sweep | 🔄 | Attack | Control |

Mirror matchups (e.g. Attack vs Attack) and diagonal pairs (Attack vs Control, Defense vs Sweep) are neutral.

The winning side of the matchup receives **+1** to their score; the losing side receives **-1**.

```
MATCHUPS[attacker][defender] → -1 | 0 | +1
```

**Source:** `src/game-data.js` lines 13-28

---

## 2. Techniques

Each position+role combination exposes a set of techniques per category. A technique has:

| Property | Type | Description |
|----------|------|-------------|
| `modifier` | 0-3 | Bonus added to the roll |
| `requiredTokens` | string[] | Tokens the player must hold to use it |
| `tokenReward` | string? | Token earned on major/dominant win |
| `tokenRemove` | string? | Opponent token removed on major+ win |
| `transition` | object? | Position change on successful hit |
| `ibjjfPoints` | 0-4 | IBJJF points awarded on transition |
| `isSubmission` | bool | Can end the match on dominant win |
| `risk` | string | `'neutral'` or `'risky'` |

**Source:** `src/game-data.js` lines 124-936

---

## 3. Score Calculation

Each side's score is computed independently:

```
Total = posControl + matchupMod + techniqueMod + tokenMod + d6
```

| Component | Range | Description |
|-----------|-------|-------------|
| `posControl` | 0-2 | Control tug-of-war pips held by this side |
| `matchupMod` | -1 to +1 | Category matchup result |
| `techniqueMod` | 0-3 | Technique's `modifier` value |
| `tokenMod` | 0-2 | +1 per active token held |
| `d6` | 1-6 | Random die roll |

**Possible total range:** 0 to 14

**Source:** `src/game-engine.js` lines 109-121

---

## 4. Outcome Tiers

After computing both totals, the **margin** determines what happens:

```
margin = |playerTotal - aiTotal|
```

| Tier | Margin | Effects |
|------|--------|---------|
| **Stalemate** | 0 | No winner, no effects |
| **Minor** | 1 | Winner determined; scoring techniques earn an advantage instead of points |
| **Major** | 2-3 | Tokens earned/removed; IBJJF points awarded; advantages from non-transition wins |
| **Dominant** | 4+ | All major effects + submissions succeed + bonus tokens + loser loses a token |

**Source:** `src/game-engine.js` lines 153-170

---

## 5. IBJJF Points

Points are awarded when **all three** conditions are met:
1. The winning technique has a `transition` (position change)
2. The technique has `ibjjfPoints > 0`
3. The outcome tier is **major or dominant**

| Transition | Points |
|------------|--------|
| Takedown | 2 |
| Sweep | 2 |
| Guard Pass | 3 |
| Mount | 4 |
| Back Control | 4 |

If the technique would score points but only achieves a **minor** win, **1 advantage** is awarded instead.

**Source:** `src/game-engine.js` lines 274-310

---

## 6. Advantages

Advantages are the IBJJF tiebreaker. They are awarded in two cases:

1. **Minor win with a scoring technique** — the technique has `ibjjfPoints > 0` but the margin is only 1. Awards 1 advantage.
2. **Major/dominant win with a non-transition technique** — control moves, defensive wins, or near-submissions. Awards 1 advantage.

Advantages break ties when the match ends at turn 20 with equal points.

**Source:** `src/game-engine.js` lines 303-329

---

## 7. Control (Tug-of-War)

Control is a per-side value from 0 to 2 (mutually exclusive — both sides can hold pips independently).

Displayed as 5 pips: `[P+2] [P+1] [neutral] [AI+1] [AI+2]`

**Shifting rules** (only when the winning category is **Control**):

1. If the **loser** has control pips → loser loses 1 pip
2. Otherwise if the **winner** has < 2 pips → winner gains 1 pip

Control pips contribute directly to the score as `posControl` (+0, +1, or +2).

**Source:** `src/game-engine.js` lines 210-222

---

## 8. Tokens

Each player can hold **up to 2 tokens** simultaneously. No duplicates allowed.

### Token Types

| ID | Name | Icon |
|----|------|------|
| `posture_broken` | Posture Broken | :small_red_triangle_down: |
| `inside_position` | Inside Position | :black_square_button: |
| `arm_isolated` | Arm Isolated | :muscle: |
| `leg_isolated` | Leg Isolated | :leg: |
| `balance_compromised` | Balance Compromised | :balance_scale: |

### Earning Tokens

- **Major/dominant win** with a technique that has `tokenReward` → earn that token
- **Dominant win** where the technique has no `tokenReward` and the winner has room → earn a random available token

### Losing Tokens

- **Major/dominant win** with a technique that has `tokenRemove` → strips that token from the opponent
- **Dominant loss** → loser loses their first token
- Some position transitions auto-clear specific tokens (e.g. standing neutral clears `balance_compromised`)

### Token Impact on Score

Each active token adds **+1** to the holder's score (`tokenMod`), up to +2 max.

### Token Gating

Powerful techniques (especially submissions) require specific tokens. For example:
- Americana / Armbar → requires `arm_isolated`
- Cross Collar Choke / Rear Naked Choke / Triangle → requires `posture_broken`
- Ankle Lock → requires `leg_isolated`

**Source:** `src/game-engine.js` lines 75-101, 224-272; `src/game-data.js` lines 5-11

---

## 9. Submissions

A technique with `isSubmission: true` ends the match **only on a dominant-tier win** (margin 4+).

If the submission technique wins at major tier, it awards **1 advantage** instead (a "close attempt").

At minor tier, no special effect beyond winning the exchange.

**Source:** `src/game-engine.js` lines 203-208

---

## 10. Match End Conditions

Checked in priority order after each turn:

| Condition | Trigger |
|-----------|---------|
| **Submission** | Dominant win with a submission technique |
| **Points victory** | Either side reaches 12 points |
| **Time expiry** | Turn 20 completed → compare points, then advantages, then referee decision (coin flip) |

**Source:** `src/game-engine.js` lines 367-419

---

## 11. AI Difficulty

The AI scores every usable (category, technique) pair and selects probabilistically.

| Difficulty | Optimal Weight | Behavior |
|------------|---------------|----------|
| Easy | 40% | Mostly random, occasionally picks best |
| Medium | 65% | Usually picks well, some suboptimal choices |
| Hard | 85% | Strongly favors optimal play |

The AI considers: technique modifier, submission availability, scoring transitions, token earning potential, control state, and risk level.

**Source:** `src/ai.js` lines 11-152
