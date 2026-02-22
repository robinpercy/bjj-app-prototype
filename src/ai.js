// ─── AI Opponent Logic ──────────────────────────────────────────────────────
// Weighted probability action selection with difficulty levels.

import {
  POSITIONS,
  getTechniquesForPositionRole, canUseTechnique,
  getAvailableCategories, getMatchupModifier,
} from './game-data.js';

// ─── Difficulty Presets ─────────────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { optimalWeight: 0.40 },
  medium: { optimalWeight: 0.65 },
  hard:   { optimalWeight: 0.85 },
};

// ─── AI Decision Making ─────────────────────────────────────────────────────

/**
 * Score a (category, technique) pair for the AI based on position context.
 * Higher score = more "optimal" for the AI.
 */
function scoreCategoryTechnique(positionId, aiRole, category, technique, aiTokens, opponentTokens, aiControl, opponentControl) {
  let score = 0;

  // Technique modifier contributes to attractiveness (currently all zero)
  score += technique.modifier;

  // Submissions are very attractive when tokens are met
  if (technique.isSubmission) {
    score += 3;
    // Even more attractive if we have the required tokens
    if (canUseTechnique(technique, aiTokens)) {
      score += 4;
    }
  }

  // Transitions that score IBJJF points are very attractive
  if (technique.transition) {
    if (technique.ibjjfPoints > 0) {
      score += technique.ibjjfPoints * 1.5;
    }
    // Non-scoring transitions (escapes) are valuable when opponent has control
    if (!technique.transition.userBecomesTop && aiRole === 'bottom') {
      score += opponentControl * 2;
    }
  }

  // Token-earning techniques are valuable when we have room
  if (technique.tokenReward && aiTokens.length < 2) {
    score += 2;
    // More valuable if it enables a submission we have available
    score += 1;
  }

  // Token-removing techniques are valuable when opponent has tokens
  if (technique.tokenRemove && opponentTokens.length > 0) {
    score += 2;
  }

  // Penalize risky techniques slightly
  if (technique.risk === 'risky') {
    score -= 1;
  }

  // Control category: more attractive when we have low control or need to strip opponent's
  if (category === 'control') {
    if (opponentControl > 0) {
      score += opponentControl * 2; // strip their control first
    } else if (aiControl < 2) {
      score += 2; // build our own control
    }
  }

  // Defense is important when opponent has high control
  if (category === 'defense' && opponentControl >= 2) {
    score += 2;
  }

  // Sweep is important when opponent has control (escape pressure)
  if (category === 'sweep' && opponentControl > 0) {
    score += opponentControl;
  }

  return Math.max(score, 0);
}

/**
 * Select an action (category + technique) for the AI.
 * Returns { category, technique }.
 */
export function aiSelectAction(state) {
  const difficulty = DIFFICULTY[state.aiDifficulty] || DIFFICULTY.medium;
  const aiRole = state.playerIsTop ? 'bottom' : 'top';
  const categories = getAvailableCategories(state.position, aiRole);

  if (categories.length === 0) {
    throw new Error(`AI has no available categories at position ${state.position} as ${aiRole}`);
  }

  // Gather all legal (category, technique) pairs with scores
  const options = [];
  for (const cat of categories) {
    const techs = getTechniquesForPositionRole(state.position, aiRole, cat);
    for (const tech of techs) {
      const usable = canUseTechnique(tech, state.tokens.ai);
      if (!usable) continue; // AI only considers techniques it can actually use
      const score = scoreCategoryTechnique(
        state.position, aiRole, cat, tech,
        state.tokens.ai, state.tokens.player,
        state.control.ai, state.control.player
      );
      options.push({ category: cat, technique: tech, score });
    }
  }

  if (options.length === 0) {
    // Fallback: pick any legal technique even without tokens, but skip already-earned rewards
    for (const cat of categories) {
      const techs = getTechniquesForPositionRole(state.position, aiRole, cat);
      for (const tech of techs) {
        if (tech.tokenReward && state.tokens.ai.includes(tech.tokenReward)) continue;
        options.push({ category: cat, technique: tech, score: 1 });
      }
    }
  }

  if (options.length === 0) {
    throw new Error('AI has no available techniques');
  }

  // Sort by score descending
  options.sort((a, b) => b.score - a.score);

  // Weighted selection: optimalWeight chance to pick from top tier
  const topScore = options[0].score;
  const topTier = options.filter(o => o.score >= topScore - 1);
  const rest = options.filter(o => o.score < topScore - 1);

  let chosen;
  if (Math.random() < difficulty.optimalWeight && topTier.length > 0) {
    // Pick randomly from top tier
    chosen = topTier[Math.floor(Math.random() * topTier.length)];
  } else if (rest.length > 0) {
    // Pick randomly from remaining
    chosen = rest[Math.floor(Math.random() * rest.length)];
  } else {
    // Only top tier available
    chosen = topTier[Math.floor(Math.random() * topTier.length)];
  }

  return { category: chosen.category, technique: chosen.technique };
}
