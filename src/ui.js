// ─── UI Renderer ────────────────────────────────────────────────────────────
// Handles all DOM updates, event binding, and visual state management.

import {
  POSITIONS, CATEGORIES, TOKEN_TYPES,
  getTechniquesForPositionRole, canUseTechnique,
} from './game-data.js';
import {
  getPlayerRole, getPlayerCategories,
  getPlayerTechniques, playerCanUseTechnique,
} from './game-engine.js';

// ─── DOM References ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── Silhouette SVGs per position ───────────────────────────────────────────
const POSITION_SVGS = {
  standing_neutral: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.6"><circle cx="65" cy="35" r="12" stroke="#f85149" stroke-width="2.5" fill="none"/>
      <line x1="65" y1="47" x2="65" y2="100" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="65" y1="65" x2="45" y2="85" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="65" y1="65" x2="85" y2="85" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="65" y1="100" x2="50" y2="140" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="65" y1="100" x2="80" y2="140" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
      <g opacity="0.6"><circle cx="115" cy="35" r="12" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="115" y1="47" x2="115" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="115" y1="65" x2="95" y2="85" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="115" y1="65" x2="135" y2="85" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="115" y1="100" x2="100" y2="140" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="115" y1="100" x2="130" y2="140" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  closed_guard: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><line x1="40" y1="120" x2="140" y2="120" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="140" cy="120" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="80" y1="120" x2="75" y2="90" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="100" y1="120" x2="95" y2="90" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="50" y1="120" x2="35" y2="145" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="60" y1="120" x2="50" y2="150" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="85" cy="70" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="85" y1="81" x2="85" y2="115" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="85" y1="90" x2="65" y2="105" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="85" y1="90" x2="105" y2="105" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="85" y1="115" x2="70" y2="140" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="85" y1="115" x2="100" y2="140" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  open_guard: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><line x1="50" y1="125" x2="140" y2="125" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="140" cy="125" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="80" y1="125" x2="70" y2="95" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="100" y1="125" x2="90" y2="95" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="55" y1="125" x2="50" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="60" y1="125" x2="65" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="80" cy="62" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="80" y1="73" x2="80" y2="108" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="80" y1="85" x2="60" y2="100" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="85" x2="100" y2="100" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="108" x2="65" y2="135" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="108" x2="95" y2="135" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  half_guard: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><line x1="45" y1="125" x2="135" y2="125" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="135" cy="125" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="85" y1="125" x2="80" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="95" y1="125" x2="90" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="55" y1="125" x2="55" y2="145" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="65" y1="125" x2="75" y2="140" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="80" cy="75" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="80" y1="86" x2="85" y2="118" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="80" y1="95" x2="60" y2="110" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="95" x2="100" y2="110" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="85" y1="118" x2="70" y2="145" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="85" y1="118" x2="100" y2="145" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  side_control: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><line x1="35" y1="125" x2="140" y2="125" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="140" cy="125" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="90" y1="125" x2="95" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="110" y1="125" x2="108" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="45" y1="125" x2="30" y2="150" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="55" y1="125" x2="45" y2="155" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><line x1="70" y1="95" x2="115" y2="80" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <circle cx="65" cy="90" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="85" y1="90" x2="100" y2="115" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="100" y1="85" x2="120" y2="108" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="115" y1="80" x2="140" y2="65" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="115" y1="80" x2="145" y2="82" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  mount: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><line x1="35" y1="130" x2="145" y2="130" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="145" cy="130" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="90" y1="130" x2="85" y2="105" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="110" y1="130" x2="115" y2="105" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="45" y1="130" x2="30" y2="155" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="55" y1="130" x2="50" y2="158" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="90" cy="60" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="90" y1="71" x2="90" y2="110" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="90" y1="85" x2="65" y2="100" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="85" x2="115" y2="100" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="110" x2="70" y2="135" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="110" x2="110" y2="135" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  back_control: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><circle cx="90" cy="80" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="90" y1="91" x2="90" y2="125" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="105" x2="70" y2="115" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="105" x2="110" y2="115" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="125" x2="75" y2="150" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="125" x2="105" y2="150" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="90" cy="55" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="90" y1="66" x2="90" y2="100" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="90" y1="78" x2="68" y2="95" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="78" x2="112" y2="95" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="100" x2="72" y2="128" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="100" x2="108" y2="128" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  turtle: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><circle cx="130" cy="115" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="120" y1="115" x2="70" y2="110" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="100" y1="112" x2="95" y2="140" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="111" x2="75" y2="140" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="105" y1="112" x2="115" y2="138" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="75" y1="111" x2="60" y2="138" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="90" cy="72" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="90" y1="83" x2="90" y2="108" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="90" y1="92" x2="65" y2="100" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="92" x2="115" y2="100" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="108" x2="75" y2="135" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="108" x2="105" y2="135" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  front_headlock: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><circle cx="100" cy="95" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="100" y1="106" x2="95" y2="130" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="100" y1="112" x2="80" y2="125" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="100" y1="112" x2="120" y2="120" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="95" y1="130" x2="80" y2="155" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="95" y1="130" x2="110" y2="155" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="80" cy="55" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="80" y1="66" x2="80" y2="100" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="80" y1="78" x2="60" y2="90" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="78" x2="100" y2="88" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="100" x2="65" y2="130" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="100" x2="95" y2="130" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
  knee_shield: `
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.5"><line x1="45" y1="125" x2="140" y2="125" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="140" cy="125" r="11" stroke="#58a6ff" stroke-width="2.5" fill="none"/>
      <line x1="90" y1="125" x2="80" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="100" y1="125" x2="90" y2="100" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="55" y1="125" x2="55" y2="95" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="65" y1="125" x2="85" y2="105" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round"/></g>
      <g><circle cx="80" cy="68" r="11" stroke="#f85149" stroke-width="2.5" fill="rgba(248,81,73,0.12)"/>
      <line x1="80" y1="79" x2="82" y2="112" stroke="#f85149" stroke-width="3" stroke-linecap="round"/>
      <line x1="80" y1="90" x2="60" y2="105" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="80" y1="90" x2="100" y2="105" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="82" y1="112" x2="67" y2="140" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="82" y1="112" x2="97" y2="140" stroke="#f85149" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`,
};

// ─── Category Icon/Hint Mapping for Techniques ──────────────────────────────
const TECHNIQUE_ICONS = {
  // Attacks
  takedown: '🤼', guard_pull: '⬇️', knee_cut_pass: '🦵', torreando_pass: '💨',
  mount_transition: '⬆️', back_take: '🔄', americana: '💪', kimura: '🔒',
  cross_collar_choke: '✋', rear_naked_choke: '🐍', armbar: '💪', triangle: '🔺',
  guillotine: '⚡', darce_choke: '🌀', ezekiel_choke: '✊', ankle_lock: '🦶',
  // Control
  crossface: '🤚', chest_pressure: '⬇️', seatbelt_grip: '🔗', head_control: '✋',
  collar_tie: '🤝', posture_break: '⬇️', underhook_control: '🔲', wrist_control: '✊',
  leg_lace: '🦵', knee_shield_frame: '🛡️', body_lock: '🔒',
  // Defense
  frame_and_shrimp: '🦐', guard_recovery: '🔄', posture_up: '⬆️',
  hand_fighting: '✋', bridge: '🌉', turtle_up: '🐢', sprawl: '🏋️', shell_guard: '🛡️',
  // Reversal
  scissor_sweep: '✂️', hip_bump_sweep: '💥', elbow_escape: '🔓',
  trap_and_roll: '🎲', granby_roll: '🌀', technical_standup: '🧍',
  back_escape: '🏃', old_school_sweep: '🔄', sit_out: '↩️',
  knee_shield_recover: '🛡️', headlock_escape: '↪️',
};

function getTechDescription(tech) {
  const parts = [];
  if (tech.isSubmission) parts.push('Submission attempt');
  if (tech.transition) {
    const target = POSITIONS[tech.transition.position];
    parts.push(`→ ${target?.name || tech.transition.position}`);
  }
  if (tech.tokenReward) parts.push(`Earns: ${TOKEN_TYPES[tech.tokenReward].name}`);
  if (tech.tokenRemove) parts.push(`Removes opp: ${TOKEN_TYPES[tech.tokenRemove].name}`);
  if (tech.risk === 'risky') parts.push('Risky');
  if (parts.length === 0) parts.push('Maintain position');
  return parts.join(' · ');
}

// ─── Screen Management ──────────────────────────────────────────────────────

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  $(screenId).classList.add('active');
}

// ─── Render Functions ───────────────────────────────────────────────────────

export function renderMatchState(state) {
  const pos = POSITIONS[state.position];
  const playerRole = getPlayerRole(state);

  // Scores
  $('score-player').textContent = state.scores.player;
  $('score-ai').textContent = state.scores.ai;

  // Turn
  $('turn-number').textContent = state.turnNumber;
  $('ai-difficulty-label').textContent =
    state.aiDifficulty.charAt(0).toUpperCase() + state.aiDifficulty.slice(1);

  // Position
  $('position-name').textContent = pos.name;

  // Initiative
  const badge = $('initiative-badge');
  badge.className = 'initiative-badge ' + (playerRole === 'top' ? 'top' : playerRole === 'bottom' ? 'bottom' : 'neutral');
  const initText = playerRole === 'top'
    ? 'You: Top Position'
    : pos.initiative === 'neutral'
      ? 'Neutral'
      : 'You: Bottom Position';
  $('initiative-text').textContent = initText;

  // Silhouette
  $('silhouette-container').innerHTML = POSITION_SVGS[state.position] || POSITION_SVGS.standing_neutral;

  // Advantage pips
  const pips = $('advantage-pips');
  pips.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip' + (i < pos.advantage ? ' filled' : '');
    pips.appendChild(pip);
  }
  $('advantage-value').textContent = pos.advantage > 0 ? `+${pos.advantage}` : '+0';

  // Tokens
  renderTokens('player-tokens', state.tokens.player);
  renderTokens('ai-tokens', state.tokens.ai);

  // Turn indicator
  const turnText = $('turn-text');
  const pulseDot = $('pulse-dot');
  turnText.textContent = 'Select Your Action';
  turnText.className = 'turn-text selecting';
  pulseDot.className = 'pulse-dot';
}

function renderTokens(containerId, tokens) {
  const container = $(containerId);
  container.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const badge = document.createElement('div');
    if (tokens[i]) {
      const t = TOKEN_TYPES[tokens[i]];
      badge.className = 'token-badge active';
      badge.innerHTML = `<span class="token-icon">${t.icon}</span> ${t.name}`;
    } else {
      badge.className = 'token-badge empty';
      badge.innerHTML = '<span class="token-icon">○</span> Empty';
    }
    container.appendChild(badge);
  }
}

// ─── Action Buttons ─────────────────────────────────────────────────────────

/**
 * Render the 4 action category buttons.
 * Determines button state: optimal, neutral, risky, disabled.
 */
export function renderActionButtons(state, onCategorySelect) {
  const grid = $('action-grid');
  grid.innerHTML = '';

  const playerRole = getPlayerRole(state);
  const available = getPlayerCategories(state);
  const allCategories = ['attack', 'control', 'defense', 'reversal'];

  // Determine which category is "optimal" — the one that has the highest expected value
  // For simplicity: if you're top, attack/control are optimal; if bottom, defense/reversal
  const optimalCategories = playerRole === 'top'
    ? ['attack']
    : ['reversal'];

  for (const catId of allCategories) {
    const cat = CATEGORIES[catId];
    const isAvailable = available.includes(catId);
    const btn = document.createElement('div');

    // Check if any techniques in this category are risky
    const techs = isAvailable ? getTechniquesForPositionRole(state.position, playerRole, catId) : [];
    const allRisky = techs.length > 0 && techs.every(t => t.risk === 'risky');

    let btnState;
    if (!isAvailable) {
      btnState = 'disabled';
    } else if (optimalCategories.includes(catId)) {
      btnState = 'optimal';
    } else if (allRisky) {
      btnState = 'risky';
    } else {
      btnState = 'neutral';
    }

    btn.className = `action-btn ${btnState}`;
    btn.innerHTML = `
      <span class="act-icon">${cat.icon}</span>
      <span class="act-name">${cat.name}</span>
      <span class="act-hint">${cat.hint}</span>
    `;

    if (isAvailable) {
      btn.addEventListener('click', () => onCategorySelect(catId));
    }

    grid.appendChild(btn);
  }
}

// ─── Technique Drawer ───────────────────────────────────────────────────────

export function openTechniqueDrawer(state, category, onTechniqueSelect) {
  const cat = CATEGORIES[category];
  const playerRole = getPlayerRole(state);
  const techs = getPlayerTechniques(state, category);

  $('drawer-title').textContent = `${cat.name} Techniques`;
  $('drawer-title').style.color = category === 'attack' ? 'var(--red)' :
    category === 'control' ? 'var(--accent)' :
    category === 'defense' ? 'var(--green)' : 'var(--purple)';

  const list = $('technique-list');
  list.innerHTML = '';

  for (const tech of techs) {
    const usable = playerCanUseTechnique(state, tech);
    const item = document.createElement('div');
    item.className = 'technique-item' + (usable ? '' : ' locked');

    const reqText = tech.requiredTokens.length > 0
      ? tech.requiredTokens.map(r => TOKEN_TYPES[r].name).join(', ')
      : 'No requirement';

    const reqClass = tech.requiredTokens.length > 0
      ? (usable ? '' : ' locked-req')
      : ' none';

    const icon = TECHNIQUE_ICONS[tech.id] || '⚡';
    const desc = getTechDescription(tech);

    item.innerHTML = `
      <span class="tech-icon">${icon}</span>
      <div class="tech-info">
        <div class="tech-name">${tech.name}</div>
        <div class="tech-desc">${desc}</div>
      </div>
      <div class="tech-meta">
        <span class="tech-mod">+${tech.modifier}</span>
        <span class="tech-req${reqClass}">${usable ? '' : '🔒 '}${reqText}</span>
      </div>
    `;

    if (usable) {
      item.addEventListener('click', () => {
        closeTechniqueDrawer();
        onTechniqueSelect(tech);
      });
    }

    list.appendChild(item);
  }

  $('technique-drawer').classList.add('open');
  $('overlay-backdrop').classList.add('visible');
}

export function closeTechniqueDrawer() {
  $('technique-drawer').classList.remove('open');
  $('overlay-backdrop').classList.remove('visible');
}

// ─── Resolution Display ─────────────────────────────────────────────────────

export function showResolution(state, resolution, onContinue) {
  const overlay = $('resolution-overlay');

  // Header
  const header = $('res-header');
  if (resolution.submission) {
    header.textContent = 'SUBMISSION!';
    header.className = 'res-header submission';
  } else {
    const tierLabels = { minor: 'Minor Exchange', major: 'Major Exchange', dominant: 'Dominant Exchange' };
    header.textContent = tierLabels[resolution.tier] || 'Resolution';
    header.className = 'res-header ' + resolution.tier;
  }

  // Player side
  const playerCat = CATEGORIES[state.playerCategory];
  $('res-player-category').textContent = playerCat.icon + ' ' + playerCat.name;
  $('res-player-technique').textContent = state.playerTechnique.name;
  $('res-player-score').textContent = resolution.playerScore.total;
  const pb = resolution.playerScore.breakdown;
  $('res-player-breakdown').innerHTML =
    `Pos: ${pb.posAdvantage} · Match: ${pb.matchupMod > 0 ? '+' : ''}${pb.matchupMod}<br>` +
    `Tech: +${pb.techniqueMod} · Tok: +${pb.tokenMod} · Die: ${pb.die}`;

  // AI side
  const aiCat = CATEGORIES[state.aiCategory];
  $('res-ai-category').textContent = aiCat.icon + ' ' + aiCat.name;
  $('res-ai-technique').textContent = state.aiTechnique.name;
  $('res-ai-score').textContent = resolution.aiScore.total;
  const ab = resolution.aiScore.breakdown;
  $('res-ai-breakdown').innerHTML =
    `Pos: ${ab.posAdvantage} · Match: ${ab.matchupMod > 0 ? '+' : ''}${ab.matchupMod}<br>` +
    `Tech: +${ab.techniqueMod} · Tok: +${ab.tokenMod} · Die: ${ab.die}`;

  // Outcome
  const outcome = $('res-outcome');
  if (resolution.winner === 'player') {
    outcome.textContent = resolution.submission
      ? `You win by ${resolution.winnerTechnique.name}!`
      : `You win the exchange! (margin: ${resolution.margin})`;
    outcome.className = 'res-outcome win';
  } else if (resolution.margin === 0) {
    outcome.textContent = 'Even exchange!';
    outcome.className = 'res-outcome draw';
  } else {
    outcome.textContent = resolution.submission
      ? `Opponent wins by ${resolution.winnerTechnique.name}!`
      : `Opponent wins the exchange! (margin: ${resolution.margin})`;
    outcome.className = 'res-outcome lose';
  }

  // Narratives
  const narratives = $('res-narratives');
  narratives.innerHTML = '';
  for (const n of resolution.narratives) {
    const item = document.createElement('div');
    item.className = 'res-narrative-item';
    item.textContent = n;
    narratives.appendChild(item);
  }

  overlay.classList.add('visible');

  // Continue button
  const btn = $('res-continue');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.id = 'res-continue';
  newBtn.addEventListener('click', () => {
    overlay.classList.remove('visible');
    onContinue();
  });
}

// ─── Match End ──────────────────────────────────────────────────────────────

export function renderMatchEnd(state, onRematch, onMenu) {
  const isWin = state.matchWinner === 'player';
  $('end-icon').textContent = isWin ? '🏆' : '😔';
  $('end-title').textContent = isWin ? 'Victory!' : 'Defeat';
  $('end-title').className = 'end-title ' + (isWin ? 'win' : 'lose');
  $('end-reason').textContent = state.matchEndReason || '';
  $('end-score').innerHTML =
    `<span style="color:var(--accent)">${state.scores.player}</span>` +
    ` <span style="color:var(--text-dim)">–</span> ` +
    `<span style="color:var(--red)">${state.scores.ai}</span>`;

  // Bind buttons
  const rematch = $('btn-rematch');
  const menu = $('btn-menu');
  const newRematch = rematch.cloneNode(true);
  const newMenu = menu.cloneNode(true);
  rematch.parentNode.replaceChild(newRematch, rematch);
  menu.parentNode.replaceChild(newMenu, menu);
  newRematch.id = 'btn-rematch';
  newMenu.id = 'btn-menu';
  newRematch.addEventListener('click', onRematch);
  newMenu.addEventListener('click', onMenu);

  showScreen('screen-end');
}

// ─── Disable Action Area ────────────────────────────────────────────────────

export function disableActions() {
  const turnText = $('turn-text');
  turnText.textContent = 'Resolving...';
  turnText.className = 'turn-text resolving';
  $('pulse-dot').className = 'pulse-dot resolving';

  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.classList.add('disabled');
    btn.style.pointerEvents = 'none';
  });
}
