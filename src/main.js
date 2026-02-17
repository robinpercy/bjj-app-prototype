// ─── Main Entry Point ───────────────────────────────────────────────────────
// Wires together game engine, AI, and UI into the game loop.

import './style.css';
import {
  createGameState, startMatch, startTurn, lockActions,
  resolveAndAdvance, nextTurn, TURN_PHASES,
} from './game-engine.js';
import { aiSelectAction } from './ai.js';
import {
  showScreen, renderMatchState, renderActionButtons,
  openTechniqueDrawer, closeTechniqueDrawer, showResolution,
  renderMatchEnd, disableActions,
} from './ui.js';

// ─── Game State ─────────────────────────────────────────────────────────────
let state = createGameState();

// ─── Start Screen ───────────────────────────────────────────────────────────

function initStartScreen() {
  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.aiDifficulty = btn.dataset.diff;
    });
  });

  // Start button
  document.getElementById('btn-start').addEventListener('click', () => {
    beginMatch();
  });
}

// ─── Game Flow ──────────────────────────────────────────────────────────────

function beginMatch() {
  state = createGameState();
  // Preserve difficulty selection
  const activeDiff = document.querySelector('.diff-btn.active');
  if (activeDiff) state.aiDifficulty = activeDiff.dataset.diff;

  startMatch(state);
  showScreen('screen-match');
  beginTurn();
}

function beginTurn() {
  startTurn(state);
  renderMatchState(state);
  renderActionButtons(state, onCategorySelect);
}

function onCategorySelect(category) {
  openTechniqueDrawer(state, category, onTechniqueSelect);
}

function onTechniqueSelect(technique) {
  // Player has chosen - now AI chooses
  const aiAction = aiSelectAction(state);

  // Lock actions
  lockActions(state, technique.category, technique, aiAction.category, aiAction.technique);

  // Disable UI
  disableActions();

  // Short delay before resolution for dramatic effect
  setTimeout(() => {
    const resolution = resolveAndAdvance(state);

    showResolution(state, resolution, () => {
      if (state.phase === TURN_PHASES.MATCH_END) {
        renderMatchEnd(state, () => beginMatch(), () => {
          showScreen('screen-start');
        });
      } else {
        nextTurn(state);
        beginTurn();
      }
    });
  }, 600);
}

// ─── Drawer Close Handlers ──────────────────────────────────────────────────

document.getElementById('overlay-backdrop').addEventListener('click', closeTechniqueDrawer);
document.getElementById('drawer-close').addEventListener('click', closeTechniqueDrawer);

// ─── How to Play ────────────────────────────────────────────────────────────

const htpOverlay = document.getElementById('how-to-play-overlay');
document.getElementById('btn-how-to-play').addEventListener('click', () => {
  htpOverlay.classList.add('visible');
});
document.getElementById('htp-close').addEventListener('click', () => {
  htpOverlay.classList.remove('visible');
});
htpOverlay.addEventListener('click', (e) => {
  if (e.target === htpOverlay) htpOverlay.classList.remove('visible');
});

// ─── Initialize ─────────────────────────────────────────────────────────────
initStartScreen();
showScreen('screen-start');
