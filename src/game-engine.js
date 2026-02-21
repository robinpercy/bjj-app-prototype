// ─── BJJ Game Engine ────────────────────────────────────────────────────────
// State machine, resolution system, token management, and scoring.

import {
  POSITIONS, TECHNIQUES, TOKEN_TYPES,
  getTechniquesForPositionRole, canUseTechnique,
  getAvailableCategories, getMatchupModifier,
} from './game-data.js';

// ─── Constants ──────────────────────────────────────────────────────────────
export const MAX_TOKENS = 2;
export const POINTS_TO_WIN = 12;
export const MAX_TURNS = 20;

export const TURN_PHASES = {
  MATCH_START:      'match_start',
  TURN_START:       'turn_start',
  ACTION_SELECTION: 'action_selection',
  ACTION_LOCKED:    'action_locked',
  RESOLUTION:       'resolution',
  TURN_END:         'turn_end',
  MATCH_END:        'match_end',
};

export const OUTCOME_TIERS = {
  MINOR:    'minor',     // margin 0-1
  MAJOR:    'major',     // margin 2-3
  DOMINANT: 'dominant',  // margin 4+
};

// ─── Game State Factory ─────────────────────────────────────────────────────

export function createGameState() {
  return {
    phase: TURN_PHASES.MATCH_START,
    turnNumber: 0,
    position: 'standing_neutral',
    // playerIsTop: true means player has initiative/top position
    // For neutral positions, this determines who is considered "top" for action purposes
    playerIsTop: true,

    scores: { player: 0, ai: 0 },
    advantages: { player: 0, ai: 0 },

    // Active tokens (array of token type IDs, max 2 each)
    tokens: { player: [], ai: [] },

    // Control tug-of-war (0-2 each, only one side holds points at a time)
    control: { player: 0, ai: 0 },

    // Current turn selections
    playerCategory: null,
    playerTechnique: null,
    aiCategory: null,
    aiTechnique: null,

    // Last resolution result (for UI display)
    lastResolution: null,

    // Match result
    matchWinner: null,
    matchEndReason: null,

    // AI difficulty
    aiDifficulty: 'medium',
  };
}

// ─── Dice ───────────────────────────────────────────────────────────────────

export function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

// ─── Token Management ───────────────────────────────────────────────────────

export function addToken(state, who, tokenId) {
  const tokens = state.tokens[who];
  // Can't stack same token, max 2 tokens
  if (tokens.includes(tokenId)) return false;
  if (tokens.length >= MAX_TOKENS) return false;
  tokens.push(tokenId);
  return true;
}

export function removeToken(state, who, tokenId) {
  const tokens = state.tokens[who];
  const idx = tokens.indexOf(tokenId);
  if (idx === -1) return false;
  tokens.splice(idx, 1);
  return true;
}

export function clearAutoClearTokens(state, positionId) {
  const pos = POSITIONS[positionId];
  if (!pos || !pos.autoClearTokens) return;
  for (const tokenId of pos.autoClearTokens) {
    removeToken(state, 'player', tokenId);
    removeToken(state, 'ai', tokenId);
  }
}

// ─── Resolution System ──────────────────────────────────────────────────────

/**
 * Calculate resolution score for one player.
 * Score = Position Control + Matchup Modifier + Technique Modifier + Token Modifier + d6
 */
function calculateScore(positionId, isTopPlayer, category, technique, opponentCategory, tokens, controlPoints) {
  const posControl = controlPoints;
  const matchupMod = getMatchupModifier(category, opponentCategory);
  const techniqueMod = technique.modifier;
  // Token modifier: +1 for each active token
  const tokenMod = tokens.length;
  const die = rollD6();

  return {
    total: posControl + matchupMod + techniqueMod + tokenMod + die,
    breakdown: { posControl, matchupMod, techniqueMod, tokenMod, die },
  };
}

/**
 * Determine outcome tier from margin.
 */
function getOutcomeTier(margin) {
  if (margin <= 1) return OUTCOME_TIERS.MINOR;
  if (margin <= 3) return OUTCOME_TIERS.MAJOR;
  return OUTCOME_TIERS.DOMINANT;
}

/**
 * Get IBJJF scoring label for a technique.
 */
function getIbjjfLabel(technique) {
  if (technique.ibjjfPoints === 2) {
    if (technique.id === 'takedown') return 'Takedown';
    return 'Sweep';
  }
  if (technique.ibjjfPoints === 3) return 'Guard Pass';
  if (technique.ibjjfPoints === 4) {
    if (technique.transition?.position === 'mount') return 'Mount';
    return 'Back Control';
  }
  return '';
}

/**
 * Resolve a complete turn using IBJJF position-based scoring.
 * Points are awarded for achieving positions (transitions), not from exchange margin.
 * The exchange roll determines who wins; the winner's technique determines what happens.
 */
export function resolveTurn(state) {
  const playerScore = calculateScore(
    state.position, state.playerIsTop,
    state.playerCategory, state.playerTechnique,
    state.aiCategory, state.tokens.player, state.control.player
  );
  const aiScore = calculateScore(
    state.position, !state.playerIsTop,
    state.aiCategory, state.aiTechnique,
    state.playerCategory, state.tokens.ai, state.control.ai
  );

  const margin = Math.abs(playerScore.total - aiScore.total);
  const tier = getOutcomeTier(margin);

  const resolution = {
    playerScore,
    aiScore,
    margin,
    winner: null,
    loser: null,
    tier,
    winnerTechnique: null,
    loserTechnique: null,
    pointsAwarded: 0,
    advantagesAwarded: 0,
    tokensGained: [],
    tokensLost: [],
    positionChange: null,
    controlShift: null,
    submission: false,
    narratives: [],
  };

  // ── DRAW: margin 0, true stalemate ──
  if (margin === 0) {
    resolution.narratives.push('Stalemate! Neither fighter gains an edge.');
    return resolution;
  }

  // ── Determine winner ──
  const winner = playerScore.total > aiScore.total ? 'player' : 'ai';
  const loser = winner === 'player' ? 'ai' : 'player';
  resolution.winner = winner;
  resolution.loser = loser;
  resolution.winnerTechnique = winner === 'player' ? state.playerTechnique : state.aiTechnique;
  resolution.loserTechnique = winner === 'player' ? state.aiTechnique : state.playerTechnique;

  const winnerTechnique = resolution.winnerTechnique;

  // ── Check for submission (requires dominant tier) ──
  if (winnerTechnique.isSubmission && tier === OUTCOME_TIERS.DOMINANT) {
    resolution.submission = true;
    resolution.narratives.push(`${winnerTechnique.name} locked in! Submission!`);
    return resolution;
  }

  // ── Control shifting ──
  const winnerCat = winner === 'player' ? state.playerCategory : state.aiCategory;
  if (winnerCat === 'control') {
    if (state.control[loser] > 0) {
      state.control[loser] -= 1;
      resolution.controlShift = { lost: loser };
      resolution.narratives.push(`${loser === 'player' ? 'You lose' : 'Opponent loses'} a control point!`);
    } else if (state.control[winner] < 2) {
      state.control[winner] += 1;
      resolution.controlShift = { gained: winner };
      resolution.narratives.push(`${winner === 'player' ? 'You gain' : 'Opponent gains'} a control point!`);
    }
  }

  // ── Token handling ──

  // Token gains on major/dominant wins
  if (tier === OUTCOME_TIERS.MAJOR || tier === OUTCOME_TIERS.DOMINANT) {
    if (winnerTechnique.tokenReward) {
      const added = addToken(state, winner, winnerTechnique.tokenReward);
      if (added) {
        resolution.tokensGained.push({ who: winner, token: winnerTechnique.tokenReward });
        resolution.narratives.push(
          `${winner === 'player' ? 'You gain' : 'Opponent gains'} ${TOKEN_TYPES[winnerTechnique.tokenReward].name}!`
        );
      }
    }
    // On dominant, grant a bonus token if technique didn't grant one
    if (tier === OUTCOME_TIERS.DOMINANT && !winnerTechnique.tokenReward) {
      const possibleTokens = ['posture_broken', 'inside_position', 'arm_isolated', 'balance_compromised', 'leg_isolated'];
      const currentTokens = state.tokens[winner];
      const available = possibleTokens.filter(t => !currentTokens.includes(t));
      if (available.length > 0 && currentTokens.length < MAX_TOKENS) {
        const bonus = available[Math.floor(Math.random() * available.length)];
        addToken(state, winner, bonus);
        resolution.tokensGained.push({ who: winner, token: bonus });
        resolution.narratives.push(
          `${winner === 'player' ? 'You gain' : 'Opponent gains'} ${TOKEN_TYPES[bonus].name}!`
        );
      }
    }
  }

  // Token removal (winner's technique removes opponent's token)
  if (winnerTechnique.tokenRemove && tier !== OUTCOME_TIERS.MINOR) {
    const removed = removeToken(state, loser, winnerTechnique.tokenRemove);
    if (removed) {
      resolution.tokensLost.push({ who: loser, token: winnerTechnique.tokenRemove });
      resolution.narratives.push(
        `${loser === 'player' ? 'You lose' : 'Opponent loses'} ${TOKEN_TYPES[winnerTechnique.tokenRemove].name}!`
      );
    }
  }

  // Loser's token removed on dominant loss
  if (tier === OUTCOME_TIERS.DOMINANT && state.tokens[loser].length > 0) {
    const lostToken = state.tokens[loser][0];
    removeToken(state, loser, lostToken);
    resolution.tokensLost.push({ who: loser, token: lostToken });
    resolution.narratives.push(
      `${loser === 'player' ? 'You lose' : 'Opponent loses'} ${TOKEN_TYPES[lostToken].name}!`
    );
  }

  // ── Position transition + IBJJF scoring ──
  if (winnerTechnique.transition) {
    const t = winnerTechnique.transition;
    const oldPos = state.position;
    const newPos = POSITIONS[t.position];

    // Execute the transition (position changes whenever the technique wins)
    resolution.positionChange = { from: oldPos, to: t.position };

    if (winner === 'player') {
      state.playerIsTop = t.userBecomesTop;
    } else {
      state.playerIsTop = !t.userBecomesTop;
    }
    state.position = t.position;
    clearAutoClearTokens(state, t.position);

    resolution.narratives.push(`Transition to ${newPos.name}!`);

    // IBJJF scoring: points only on major/dominant, advantage on minor
    if (winnerTechnique.ibjjfPoints > 0) {
      if (tier === OUTCOME_TIERS.MAJOR || tier === OUTCOME_TIERS.DOMINANT) {
        resolution.pointsAwarded = winnerTechnique.ibjjfPoints;
        state.scores[winner] += resolution.pointsAwarded;
        const label = getIbjjfLabel(winnerTechnique);
        resolution.narratives.push(
          `${winner === 'player' ? 'You score' : 'Opponent scores'} ${resolution.pointsAwarded} points! (${label})`
        );
      } else {
        // Minor win with scoring technique: advantage only
        resolution.advantagesAwarded = 1;
        state.advantages[winner] += 1;
        resolution.narratives.push(
          `Close exchange! ${winner === 'player' ? 'You earn' : 'Opponent earns'} an advantage.`
        );
      }
    }
  } else {
    // Non-transition technique
    if (tier === OUTCOME_TIERS.MAJOR || tier === OUTCOME_TIERS.DOMINANT) {
      // Strong win with control/defense/near-sub: advantage
      resolution.advantagesAwarded = 1;
      state.advantages[winner] += 1;
      if (winnerTechnique.isSubmission) {
        resolution.narratives.push(
          `Close submission attempt! ${winner === 'player' ? 'You earn' : 'Opponent earns'} an advantage.`
        );
      } else {
        resolution.narratives.push(
          `Dominant control! ${winner === 'player' ? 'You earn' : 'Opponent earns'} an advantage.`
        );
      }
    } else {
      // Minor win, no transition: tight exchange
      resolution.narratives.push('A tense exchange — neither fighter gains much ground.');
    }
  }

  return resolution;
}

// ─── State Machine Transitions ──────────────────────────────────────────────

export function startMatch(state) {
  state.phase = TURN_PHASES.TURN_START;
  state.turnNumber = 1;
  state.position = 'standing_neutral';
  state.playerIsTop = Math.random() > 0.5; // random who is "top" for neutral
  state.scores = { player: 0, ai: 0 };
  state.advantages = { player: 0, ai: 0 };
  state.tokens = { player: [], ai: [] };
  state.control = { player: 0, ai: 0 };
  state.matchWinner = null;
  state.matchEndReason = null;
  state.lastResolution = null;
}

export function startTurn(state) {
  state.phase = TURN_PHASES.ACTION_SELECTION;
  state.playerCategory = null;
  state.playerTechnique = null;
  state.aiCategory = null;
  state.aiTechnique = null;
}

export function lockActions(state, playerCategory, playerTechnique, aiCategory, aiTechnique) {
  state.playerCategory = playerCategory;
  state.playerTechnique = playerTechnique;
  state.aiCategory = aiCategory;
  state.aiTechnique = aiTechnique;
  state.phase = TURN_PHASES.ACTION_LOCKED;
}

export function resolveAndAdvance(state) {
  state.phase = TURN_PHASES.RESOLUTION;
  const resolution = resolveTurn(state);
  state.lastResolution = resolution;

  // Check for submission
  if (resolution.submission) {
    state.matchWinner = resolution.winner;
    state.matchEndReason = `Submission by ${resolution.winnerTechnique.name}!`;
    state.phase = TURN_PHASES.MATCH_END;
    return resolution;
  }

  // Check for point win
  if (state.scores.player >= POINTS_TO_WIN) {
    state.matchWinner = 'player';
    state.matchEndReason = 'Points victory!';
    state.phase = TURN_PHASES.MATCH_END;
    return resolution;
  }
  if (state.scores.ai >= POINTS_TO_WIN) {
    state.matchWinner = 'ai';
    state.matchEndReason = 'Points victory!';
    state.phase = TURN_PHASES.MATCH_END;
    return resolution;
  }

  // Check for turn limit (IBJJF-style time expiry)
  if (state.turnNumber >= MAX_TURNS) {
    if (state.scores.player > state.scores.ai) {
      state.matchWinner = 'player';
      state.matchEndReason = 'Points victory! (Time expired)';
    } else if (state.scores.ai > state.scores.player) {
      state.matchWinner = 'ai';
      state.matchEndReason = 'Points victory! (Time expired)';
    } else if (state.advantages.player > state.advantages.ai) {
      state.matchWinner = 'player';
      state.matchEndReason = 'Wins by advantages! (Points tied)';
    } else if (state.advantages.ai > state.advantages.player) {
      state.matchWinner = 'ai';
      state.matchEndReason = 'Wins by advantages! (Points tied)';
    } else {
      state.matchWinner = Math.random() > 0.5 ? 'player' : 'ai';
      state.matchEndReason = "Referee's decision! (All tied)";
    }
    state.phase = TURN_PHASES.MATCH_END;
    return resolution;
  }

  // Continue to next turn
  state.phase = TURN_PHASES.TURN_END;
  return resolution;
}

export function nextTurn(state) {
  state.turnNumber++;
  state.phase = TURN_PHASES.TURN_START;
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

/**
 * Get the player's role ('top' or 'bottom') in the current position.
 */
export function getPlayerRole(state) {
  const pos = POSITIONS[state.position];
  if (pos.initiative === 'neutral') {
    return state.playerIsTop ? 'top' : 'bottom';
  }
  return state.playerIsTop ? 'top' : 'bottom';
}

/**
 * Get the AI's role.
 */
export function getAIRole(state) {
  return getPlayerRole(state) === 'top' ? 'bottom' : 'top';
}

/**
 * Get available categories for the player.
 */
export function getPlayerCategories(state) {
  return getAvailableCategories(state.position, getPlayerRole(state));
}

/**
 * Get available techniques for the player in a given category.
 */
export function getPlayerTechniques(state, category) {
  return getTechniquesForPositionRole(state.position, getPlayerRole(state), category);
}

/**
 * Check if a technique can be used by the player (token requirements met).
 */
export function playerCanUseTechnique(state, technique) {
  return canUseTechnique(technique, state.tokens.player);
}
