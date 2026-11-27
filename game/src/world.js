// The game's rules and state, with no drawing and no browser in it: the turkey's
// run, the farmer closing in behind, the hazards and pickups of each stage, the
// haystack safe spots, score, distance and stumbles. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound. Nothing here allocates after
// createWorld returns.

import {
  CORN, ESCAPE_DISTANCE, FARMER_START_GAP, FEATHER, FIELD, HAYSTACK, HAZARDS,
  OBSTACLE, POOL_SIZE, STAGES, STUMBLES, TURKEY,
} from './config.js';

/** Pixels of scroll per metre of distance. */
const PX_PER_METRE = 20;
/** Metres the farmer closes in on each stumble. */
const GAP_PER_STUMBLE = 9;
/** Metres of gap the turkey wins back per clean second. */
const GAP_RECOVERY = 0.9;
/** Seconds the world runs at half speed after a stumble. */
const SLOW_TIME = 0.7;
/** Seconds between haystack safe spots. */
const HAYSTACK_EVERY = 24;

export const EVENT_CORN = 1;
export const EVENT_FEATHER = 2;
export const EVENT_STUMBLE = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_ESCAPED = 16;
export const EVENT_HIDE = 32;
export const EVENT_SLOW = 64;
/** A golden feather absorbed a hit: no stumble was lost. */
export const EVENT_SHIELD = 128;

export const KIND_HAZARD = 0;
export const KIND_CORN = 1;
export const KIND_FEATHER = 2;
export const KIND_HAYSTACK = 3;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The stage the turkey is running through at this distance. */
export function stageFor(distance) {
  let stage = STAGES[0];
  for (let index = 0; index < STAGES.length; index += 1) {
    if (distance >= STAGES[index].from) stage = STAGES[index];
  }
  return stage;
}

export function createWorld(random) {
  const turkey = {
    x: TURKEY.x, y: FIELD.groundY - TURKEY.height, width: TURKEY.width,
    height: TURKEY.height, vy: 0, onGround: true, ducking: false,
    coyote: 0, mercy: 0, shield: false,
  };
  const obstacles = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    obstacles.push({
      active: false, kind: KIND_HAZARD, name: '', x: 0, y: 0,
      width: 0, height: 0, duckUnder: false, soft: false, passed: false, wobble: 0,
    });
  }
  const state = {
    turkey, obstacles, score: 0, distance: 0, stumbles: STUMBLES,
    farmerGap: FARMER_START_GAP, speed: TURKEY.startSpeed, elapsed: 0,
    spawnTimer: 1.0, haystackTimer: HAYSTACK_EVERY, slowTimer: 0, hideFlash: 0,
    stage: STAGES[0], lastHazard: null, lastHazardAt: -99, jumpBuffer: 0,
  };

  function reset() {
    turkey.y = FIELD.groundY - TURKEY.height;
    turkey.height = TURKEY.height;
    turkey.vy = 0;
    turkey.onGround = true;
    turkey.ducking = false;
    turkey.coyote = 0;
    turkey.mercy = 0;
    turkey.shield = false;
    for (const item of obstacles) item.active = false;
    state.score = 0;
    state.distance = 0;
    state.stumbles = STUMBLES;
    state.farmerGap = FARMER_START_GAP;
    state.speed = TURKEY.startSpeed;
    state.elapsed = 0;
    state.spawnTimer = 1.0;
    state.haystackTimer = HAYSTACK_EVERY;
    state.slowTimer = 0;
    state.hideFlash = 0;
    state.stage = STAGES[0];
    state.lastHazard = null;
    state.lastHazardAt = -99;
    state.jumpBuffer = 0;
  }

  function freeSlot() {
    for (let index = 0; index < obstacles.length; index += 1) {
      if (!obstacles[index].active) return obstacles[index];
    }
    return null;
  }

  function spawnHazard() {
    const slot = freeSlot();
    if (slot === null) return;
    const stage = state.stage;
    // Fairness: never ask for a jump and a duck in the same breath. A hazard
    // that follows one of the other kind within a second is the same kind.
    let pool = stage.hazards;
    if (state.lastHazard !== null && state.elapsed - state.lastHazardAt < 1.3) {
      const same = stage.hazards.filter((name) => HAZARDS[name].duckUnder === (state.lastHazard === 'duck'));
      if (same.length > 0) pool = same;
    }
    const name = pool[Math.floor(random() * pool.length)];
    const shape = HAZARDS[name];
    state.lastHazard = shape.duckUnder ? 'duck' : 'ground';
    state.lastHazardAt = state.elapsed;
    slot.active = true;
    slot.kind = KIND_HAZARD;
    slot.name = name;
    slot.width = shape.width;
    slot.height = shape.height;
    slot.duckUnder = shape.duckUnder;
    slot.soft = name === 'puddle';
    slot.passed = false;
    slot.wobble = random() * Math.PI * 2;
    slot.x = FIELD.width + 40;
    slot.y = shape.duckUnder
      ? FIELD.groundY - TURKEY.duckHeight - 6 - shape.height
      : FIELD.groundY - shape.height;
  }

  function spawnCorn(high) {
    const slot = freeSlot();
    if (slot === null) return;
    slot.active = true;
    slot.kind = KIND_CORN;
    slot.name = 'corn';
    slot.width = CORN.width;
    slot.height = CORN.height;
    slot.duckUnder = false;
    slot.soft = false;
    slot.passed = false;
    slot.wobble = 0;
    slot.x = FIELD.width + 40;
    slot.y = high ? FIELD.groundY - 150 : FIELD.groundY - CORN.height;
  }

  function spawnFeather() {
    const slot = freeSlot();
    if (slot === null) return;
    slot.active = true;
    slot.kind = KIND_FEATHER;
    slot.name = 'feather';
    slot.width = FEATHER.width;
    slot.height = FEATHER.height;
    slot.duckUnder = false;
    slot.soft = false;
    slot.passed = false;
    slot.wobble = random() * Math.PI * 2;
    slot.x = FIELD.width + 40;
    slot.y = FIELD.groundY - 150;
  }

  function spawnHaystack() {
    const slot = freeSlot();
    if (slot === null) return;
    slot.active = true;
    slot.kind = KIND_HAYSTACK;
    slot.name = 'haystack';
    slot.width = HAYSTACK.width;
    slot.height = HAYSTACK.height;
    slot.duckUnder = false;
    slot.soft = false;
    slot.passed = false;
    slot.wobble = 0;
    slot.x = FIELD.width + 40;
    slot.y = FIELD.groundY - HAYSTACK.height;
  }

  function spawnInterval() {
    const shrink = Math.min(0.45, OBSTACLE.intervalPer500m * (state.distance / 500));
    return Math.max(OBSTACLE.intervalMin, OBSTACLE.interval - shrink);
  }

  /**
   * One fixed step. `input` is { jumpPressed, jumpHeld, duckHeld }.
   * `harmless` (the title screen's backdrop) scrolls the world but nothing
   * touches the turkey and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.stage = stageFor(state.distance);

    const targetSpeed = Math.min(
      TURKEY.maxSpeed,
      TURKEY.startSpeed + state.distance * TURKEY.speedPerMetre,
    );
    state.speed = state.slowTimer > 0 ? targetSpeed * 0.55 : targetSpeed;
    if (state.slowTimer > 0) state.slowTimer -= dt;
    if (state.hideFlash > 0) state.hideFlash -= dt;
    if (turkey.mercy > 0) turkey.mercy -= dt;

    // The turkey: jump (with coyote time and a cut-short release), duck, gravity.
    // On the ground the turkey sits exactly on its floor for its current height,
    // so ducking drops the head at once instead of falling into it.
    turkey.ducking = input.duckHeld && turkey.onGround;
    turkey.height = turkey.ducking ? TURKEY.duckHeight : TURKEY.height;
    if (turkey.onGround) turkey.y = FIELD.groundY - turkey.height;
    if (turkey.onGround) turkey.coyote = TURKEY.coyoteTime;
    else turkey.coyote -= dt;
    // Jump buffering: a press just before landing still jumps.
    if (input.jumpPressed) state.jumpBuffer = 0.12;
    else if (state.jumpBuffer > 0) state.jumpBuffer -= dt;
    if (state.jumpBuffer > 0 && (turkey.onGround || turkey.coyote > 0) && !turkey.ducking) {
      turkey.vy = -TURKEY.jumpVelocity;
      turkey.onGround = false;
      turkey.coyote = 0;
      state.jumpBuffer = 0;
    }
    if (!input.jumpHeld && turkey.vy < 0) turkey.vy += TURKEY.gravity * 1.8 * dt;
    // Ducking in the air slams the turkey down: dive under a hanging hazard.
    if (input.duckHeld && !turkey.onGround) turkey.vy = Math.max(turkey.vy, 1400);
    turkey.vy += TURKEY.gravity * dt;
    turkey.y += turkey.vy * dt;
    const floor = FIELD.groundY - turkey.height;
    if (turkey.y >= floor) {
      turkey.y = floor;
      turkey.vy = 0;
      turkey.onGround = true;
    } else {
      turkey.onGround = false;
    }

    state.distance += (state.speed * dt) / PX_PER_METRE;
    if (!harmless && state.distance >= ESCAPE_DISTANCE) {
      state.distance = ESCAPE_DISTANCE;
      return EVENT_ESCAPED;
    }

    // The farmer: a clean run wins the gap back, a haystack refills it at once.
    if (!harmless && turkey.mercy <= 0) {
      state.farmerGap = Math.min(FARMER_START_GAP, state.farmerGap + GAP_RECOVERY * dt);
    }

    // Spawning.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer += spawnInterval();
      const roll = random();
      if (roll < OBSTACLE.cornChance) spawnCorn(random() < 0.5);
      else if (roll < OBSTACLE.cornChance + OBSTACLE.featherChance) spawnFeather();
      else spawnHazard();
    }
    state.haystackTimer -= dt;
    if (state.haystackTimer <= 0) {
      state.haystackTimer += HAYSTACK_EVERY;
      spawnHaystack();
    }

    // Everything scrolls left at the run speed.
    for (let index = 0; index < obstacles.length; index += 1) {
      const item = obstacles[index];
      if (!item.active) continue;
      item.x -= state.speed * dt;
      item.wobble += dt * 3;
      if (item.x + item.width < -40) {
        item.active = false;
        continue;
      }
      if (!item.passed && item.x + item.width < turkey.x) {
        item.passed = true;
        if (item.kind === KIND_HAZARD && !harmless) {
          state.score += HAZARDS[item.name].clearPoints;
        }
      }
      if (harmless || !overlaps(item, turkey)) continue;
      if (item.kind === KIND_CORN) {
        item.active = false;
        state.score += CORN.points;
        events |= EVENT_CORN;
      } else if (item.kind === KIND_FEATHER) {
        item.active = false;
        state.score += FEATHER.points;
        turkey.shield = true;
        events |= EVENT_FEATHER;
      } else if (item.kind === KIND_HAYSTACK) {
        item.active = false;
        state.farmerGap = Math.min(FARMER_START_GAP, state.farmerGap + HAYSTACK.gapRefill);
        turkey.mercy = Math.max(turkey.mercy, HAYSTACK.mercy);
        state.hideFlash = 0.8;
        events |= EVENT_HIDE;
      } else if (item.soft) {
        item.active = false;
        state.slowTimer = SLOW_TIME;
        events |= EVENT_SLOW;
      } else if (turkey.mercy > 0) {
        // Mercy frames: the hazard passes straight through the turkey.
      } else if (turkey.shield) {
        // The feather takes the hit: no stumble is lost and the gap does not
        // close, so this reports its own event instead of a stumble.
        turkey.shield = false;
        item.active = false;
        turkey.mercy = TURKEY.stumbleMercy;
        events |= EVENT_SHIELD;
      } else {
        item.active = false;
        state.stumbles -= 1;
        state.farmerGap -= GAP_PER_STUMBLE;
        state.slowTimer = SLOW_TIME;
        turkey.mercy = TURKEY.stumbleMercy;
        events |= EVENT_STUMBLE;
        if (state.stumbles <= 0 || state.farmerGap <= 0) {
          events |= EVENT_CAUGHT;
          return events;
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
