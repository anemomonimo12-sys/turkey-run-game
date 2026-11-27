// The screenshot scenes behind ?shot=start|play|kitchen|end. Each one plays the
// real rules forward from a fresh world for a fixed stretch, steered by a simple
// autopilot (jump the ground hazards in time, duck under the hanging ones), so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. The end scene's pilot looks only a moment ahead, so it
// is caught out once the kitchen speeds up, as a hurried player is.

import { FIELD, STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED, KIND_HAZARD } from './world.js';
import {
  SCREEN_OVER_CAUGHT, SCREEN_OVER_ESCAPED, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const KITCHEN_TARGET = 1450;
const END_LIMIT_SECONDS = 600;
/** How far ahead, in pixels, the autopilot reacts to a hazard. */
const LOOKAHEAD_PLAY = 140;
const LOOKAHEAD_END = 260;
const SAMPLE = STEP;

/** The nearest hazard ahead of the turkey, or null. */
function nearestHazard(state, duckUnder) {
  let nearest = null;
  for (let index = 0; index < state.obstacles.length; index += 1) {
    const item = state.obstacles[index];
    if (!item.active || item.kind !== KIND_HAZARD) continue;
    if (duckUnder !== undefined && item.duckUnder !== duckUnder) continue;
    if (item.x + item.width < state.turkey.x) continue;
    if (nearest === null || item.x < nearest.x) nearest = item;
  }
  return nearest;
}

/**
 * One step of input from the autopilot: jump the ground hazards, duck under
 * the hanging ones, and stay low under a knife rack while it passes. It never
 * jumps into a hanging hazard's flight path: if one is close behind the jump
 * target, it waits and ducks under it first.
 */
function autopilot(state, lookahead) {
  const turkey = state.turkey;
  const ground = nearestHazard(state, false);
  const hanging = nearestHazard(state, true);
  let jumpPressed = false;
  let duckHeld = false;
  if (hanging !== null) {
    const hangingGap = hanging.x - (turkey.x + turkey.width);
    const groundGap = ground === null ? Infinity : ground.x - (turkey.x + turkey.width);
    // Stay ducked until the hanging hazard has fully passed the turkey.
    // Duck early: the dive is what gets the turkey under a lantern in time.
    // But never dive while a ground hazard is closer: the dive would drop the
    // turkey onto the fence or oven it was jumping over.
    if (hangingGap < 220 && hanging.x + hanging.width > turkey.x && hangingGap < groundGap) duckHeld = true;
  }
  if (ground !== null && !duckHeld) {
    const gap = ground.x - (turkey.x + turkey.width);
    const hangingAhead = hanging !== null && hanging.x - (turkey.x + turkey.width) < 560;
    if (gap < lookahead && gap > 0 && turkey.onGround && !hangingAhead) jumpPressed = true;
  }
  // Hold the jump through the whole flight: letting go early cuts it short.
  return { jumpPressed, jumpHeld: jumpPressed || !turkey.onGround, duckHeld };
}

/** Run the world forward until `stop` says so; return the events of the last step. */
function runFor(world, seconds, lookahead) {
  let events = 0;
  for (let index = 0; index < seconds / SAMPLE; index += 1) {
    events = world.step(SAMPLE, autopilot(world.state, lookahead), false);
    if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, kitchen or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 * Mercy frames are cleared first, so the turkey never blinks out of a shot.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'kitchen' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { jumpPressed: false, jumpHeld: false, duckHeld: false }, true);
    world.state.turkey.mercy = 0;
    world.state.hideFlash = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'kitchen') {
    const steps = Math.ceil(END_LIMIT_SECONDS / SAMPLE);
    for (let index = 0; index < steps; index += 1) {
      const events = world.step(SAMPLE, autopilot(world.state, LOOKAHEAD_PLAY), false);
      if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
      if (world.state.distance >= KITCHEN_TARGET) break;
    }
    const over = world.state.stumbles === 0;
    world.state.turkey.mercy = 0;
    world.state.hideFlash = 0;
    return { screen: over ? SCREEN_OVER_CAUGHT : SCREEN_PLAY, best: world.state.score };
  }
  const seconds = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const lookahead = name === 'end' ? LOOKAHEAD_END : LOOKAHEAD_PLAY;
  const events = runFor(world, seconds, lookahead);
  world.state.turkey.mercy = 0;
  world.state.hideFlash = 0;
  if (events & EVENT_ESCAPED) return { screen: SCREEN_OVER_ESCAPED, best: world.state.score };
  if (events & EVENT_CAUGHT) return { screen: SCREEN_OVER_CAUGHT, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
