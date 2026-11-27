// Keyboard and pointer input. Jump and duck are held states read every frame;
// confirm, pause and mute are one-shot presses queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const DUCK = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let jumpHeld = false;
  let duckHeld = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (JUMP.has(event.code)) {
      jumpHeld = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (DUCK.has(event.code)) {
      duckHeld = true;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (JUMP.has(event.code)) jumpHeld = false;
    else if (DUCK.has(event.code)) duckHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    jumpHeld = false;
    duckHeld = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** True while a jump key is held (hold for a higher jump). */
    jumpHeld() {
      return jumpHeld;
    },
    /** True while a duck key is held. */
    duckHeld() {
      return duckHeld;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
