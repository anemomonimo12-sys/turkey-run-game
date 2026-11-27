// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, caught and escaped.
//
// ?seed=N fixes the hazard pattern. ?shot=start|play|kitchen|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_CAUGHT, EVENT_CORN, EVENT_ESCAPED, EVENT_FEATHER,
  EVENT_HIDE, EVENT_SLOW, EVENT_STUMBLE, EVENT_SHIELD,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_OVER_CAUGHT, SCREEN_OVER_ESCAPED, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, audio.isMuted());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let jumpEdge = false;
  let previousJumpHeld = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    jumpEdge = false;
    screen = SCREEN_PLAY;
    announce('Running! Jump the fences, duck the knives, reach the forest.');
  }

  function endGame(escaped) {
    screen = escaped ? SCREEN_OVER_ESCAPED : SCREEN_OVER_CAUGHT;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (escaped) {
      audio.escaped();
      announce(`Escaped! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.caught();
      announce(`Caught for dinner. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER_CAUGHT || screen === SCREEN_OVER_ESCAPED)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Running.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { jumpPressed: false, jumpHeld: false, duckHeld: false }, true);
      return;
    }
    const jumpHeld = input.jumpHeld();
    if (jumpHeld && !previousJumpHeld) jumpEdge = true;
    previousJumpHeld = jumpHeld;
    const events = world.step(STEP, { jumpPressed: jumpEdge, jumpHeld, duckHeld: input.duckHeld() }, false);
    jumpEdge = false;
    if (events & EVENT_ESCAPED) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
    else if (events & EVENT_SHIELD) {
      audio.feather();
      announce('The golden feather saved you!');
    } else if (events & EVENT_STUMBLE) {
      audio.stumble();
      announce(`Stumble! ${world.state.stumbles} ${world.state.stumbles === 1 ? 'life' : 'lives'} left. The farmer is closer!`);
    } else if (events & EVENT_CORN) audio.corn();
    else if (events & EVENT_FEATHER) {
      audio.feather();
      announce('Golden feather! One free hit.');
    } else if (events & EVENT_HIDE) {
      audio.hide();
      announce('Hidden in the haystack — the farmer lost you!');
    } else if (events & EVENT_SLOW) announce('Mud! Slowed down.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted());
  }

  // Leaving the tab pauses a running game rather than letting the farmer catch the turkey unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Gobble Dash. Press Space or click to run from the farm.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
