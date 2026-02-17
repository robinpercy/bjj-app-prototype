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

    // Active tokens (array of token type IDs, max 2 each)
    tokens: { player: [], ai: [] },

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
 * Score = Position Advantage + Matchup Modifier + Technique Modifier + Token Modifier + d6
 */
function calculateScore(positionId, isTopPlayer, category, technique, opponentCategory, tokens) {
  const pos = POSITIONS[positionId];
  const posAdvantage = isTopPlayer ? pos.advantage : 0;
  const matchupMod = getMatchupModifier(category, opponentCategory);
  const techniqueMod = technique.modifier;
  // Token modifier: +1 for each active token
  const tokenMod = tokens.length;
  const die = rollD6();

  return {
    total: posAdvantage + matchupMod + techniqueMod + tokenMod + die,
    breakdown: { posAdvantage, matchupMod, techniqueMod, tokenMod, die },
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
 * Resolve a complete turn. Both players have selected category + technique.
 * Returns a resolution result object.
 */
export function resolveTurn(state) {
  const playerScore = calculateScore(
    state.position, state.playerIsTop,
    state.playerCategory, state.playerTechnique,
    state.aiCategory, state.tokens.player
  );
  const aiScore = calculateScore(
    state.position, !state.playerIsTop,
    state.aiCategory, state.aiTechnique,
    state.playerCategory, state.tokens.ai
  );

  const margin = Math.abs(playerScore.total - aiScore.total);
  const winner = playerScore.total >= aiScore.total ? 'player' : 'ai';
  const loser = winner === 'player' ? 'ai' : 'player';
  const tier = getOutcomeTier(margin);
  const winnerTechnique = winner === 'player' ? state.playerTechnique : state.aiTechnique;
  const loserTechnique = winner === 'player' ? state.aiTechnique : state.playerTechnique;

  const resolution = {
    playerScore,
    aiScore,
    margin,
    winner,
    loser,
    tier,
    winnerTechnique,
    loserTechnique,
    pointsAwarded: 0,
    tokensGained: [],
    tokensLost: [],
    positionChange: null,
    submission: false,
    narratives: [],
  };

  // ── Apply outcomes based on tier ──

  // Check for submission
  if (winnerTechnique.isSubmission && tier === OUTCOME_TIERS.DOMINANT) {
    resolution.submission = true;
    resolution.narratives.push(`${winnerTechnique.name} locked in! Submission!`);
    return resolution;
  }

  // Points
  if (tier === OUTCOME_TIERS.MAJOR) {
    resolution.pointsAwarded = 1;
  } else if (tier === OUTCOME_TIERS.DOMINANT) {
    resolution.pointsAwarded = 2;
  }

  // Token gains (based on spec: margin 2-3 → 1 token, 4+ → 2 tokens OR transition)
  if (tier === OUTCOME_TIERS.MAJOR || tier === OUTCOME_TIERS.DOMINANT) {
    // Winner's technique may award a specific token
    if (winnerTechnique.tokenReward) {
      const added = addToken(state, winner, winnerTechnique.tokenReward);
      if (added) {
        resolution.tokensGained.push({ who: winner, token: winnerTechnique.tokenReward });
        resolution.narratives.push(
          `${winner === 'player' ? 'You gain' : 'Opponent gains'} ${TOKEN_TYPES[winnerTechnique.tokenReward].name}!`
        );
      }
    }
    // On dominant, grant an additional generic token if technique didn't grant one
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

  // Position transition
  if (winnerTechnique.transition && tier !== OUTCOME_TIERS.MINOR) {
    const t = winnerTechnique.transition;
    const oldPos = state.position;
    resolution.positionChange = {
      from: oldPos,
      to: t.position,
    };

    // Calculate bonus points for position advancement
    const newPos = POSITIONS[t.position];
    const oldPosData = POSITIONS[oldPos];
    if (newPos.advantage > oldPosData.advantage) {
      const bonus = newPos.advantage - oldPosData.advantage;
      resolution.pointsAwarded += bonus;
      resolution.narratives.push(
        `Position advance! +${bonus} bonus points.`
      );
    }

    // Determine new top/bottom
    if (winner === 'player') {
      state.playerIsTop = t.userBecomesTop;
    } else {
      // AI used the technique, so AI becomes top if userBecomesTop
      state.playerIsTop = !t.userBecomesTop;
    }

    state.position = t.position;
    clearAutoClearTokens(state, t.position);

    resolution.narratives.push(
      `Transition to ${newPos.name}!`
    );
  }

  // Award points
  if (resolution.pointsAwarded > 0) {
    state.scores[winner] += resolution.pointsAwarded;
    resolution.narratives.push(
      `${winner === 'player' ? 'You score' : 'Opponent scores'} ${resolution.pointsAwarded} point${resolution.pointsAwarded > 1 ? 's' : ''}!`
    );
  }

  // Narrative for minor outcomes
  if (tier === OUTCOME_TIERS.MINOR) {
    resolution.narratives.push('A tense exchange — neither fighter gains much ground.');
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
  state.tokens = { player: [], ai: [] };
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
