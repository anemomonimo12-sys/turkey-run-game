// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Flat autumn shapes (a turkey, the farmer, fences,
// ovens, carving knives, haystacks), canvas text for the HUD and the panels.

import { ESCAPE_DISTANCE, FARMER_START_GAP, FIELD, FONT, PALETTE, STUMBLES } from './config.js';
import { KIND_CORN, KIND_FEATHER, KIND_HAYSTACK } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER_CAUGHT = 'over-caught';
export const SCREEN_OVER_ESCAPED = 'over-escaped';

/** Pixels of scroll per metre of distance (matches the world's scale). */
const PX_PER_METRE = 20;
const PANEL = { width: 640, line: 34, top: 150, bottom: 78 };
const HEART = 22;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  /** Rolling hills and trees (or kitchen tiles, or forest pines) scrolling past. */
  function drawBackdrop(stage, distance) {
    context.fillStyle = stage.sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Sun.
    context.fillStyle = '#fff2c0';
    context.beginPath();
    context.arc(1080, 110, 52, 0, Math.PI * 2);
    context.fill();
    // Drifting clouds and birds, for a sky that is not one flat colour.
    context.fillStyle = 'rgba(255, 243, 221, 0.85)';
    const cloudOffset = (distance * PX_PER_METRE * 0.08) % 640;
    for (let index = 0; index < 4; index += 1) {
      const cx = ((index * 640 + 180 - cloudOffset) % 1280 + 1280) % 1280 - 80;
      const cy = 70 + index * 55;
      context.beginPath();
      context.ellipse(cx, cy, 62, 20, 0, 0, Math.PI * 2);
      context.ellipse(cx + 34, cy + 6, 44, 15, 0, 0, Math.PI * 2);
      context.ellipse(cx - 38, cy + 8, 36, 13, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = 'rgba(60, 40, 20, 0.6)';
    context.lineWidth = 3;
    const birdOffset = (distance * PX_PER_METRE * 0.3) % 900;
    for (let index = 0; index < 3; index += 1) {
      const bx = ((index * 420 + 300 - birdOffset) % 1280 + 1280) % 1280 - 40;
      const by = 150 + index * 46;
      const flap = Math.sin(distance * 0.15 + index * 2) * 4;
      context.beginPath();
      context.moveTo(bx - 12, by);
      context.quadraticCurveTo(bx - 4, by - 8 - flap, bx, by);
      context.quadraticCurveTo(bx + 4, by - 8 - flap, bx + 12, by);
      context.stroke();
    }
    // Far hills.
    context.fillStyle = stage.far;
    const farOffset = (distance * PX_PER_METRE * 0.2) % 320;
    for (let x = -320; x < FIELD.width + 320; x += 320) {
      context.beginPath();
      context.arc(x - farOffset + 160, FIELD.groundY + 40, 200, Math.PI, 0);
      context.fill();
    }
    // Near bushes / trees.
    context.fillStyle = stage.near;
    const nearOffset = (distance * PX_PER_METRE * 0.5) % 200;
    for (let x = -200; x < FIELD.width + 200; x += 200) {
      context.beginPath();
      context.arc(x - nearOffset + 60, FIELD.groundY, 70, Math.PI, 0);
      context.fill();
      context.fillRect(x - nearOffset + 52, FIELD.groundY - 90, 16, 90);
    }
    // Ground.
    context.fillStyle = stage.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = stage.groundTop;
    context.fillRect(0, FIELD.groundY, FIELD.width, 10);
    // Distance markers: a little flag every 500 m.
    const flagEvery = 500 * PX_PER_METRE;
    const flagOffset = distance * PX_PER_METRE;
    for (let metres = 500; metres < ESCAPE_DISTANCE; metres += 500) {
      const x = metres * PX_PER_METRE - flagOffset + 200;
      if (x < -20 || x > FIELD.width + 20) continue;
      context.fillStyle = '#fff3dd';
      context.fillRect(x, FIELD.groundY - 84, 4, 84);
      context.fillStyle = PALETTE.danger;
      context.beginPath();
      context.moveTo(x + 4, FIELD.groundY - 84);
      context.lineTo(x + 34, FIELD.groundY - 74);
      context.lineTo(x + 4, FIELD.groundY - 64);
      context.closePath();
      context.fill();
      text(`${metres}m`, x + 18, FIELD.groundY - 92, 18, PALETTE.text, 'center');
    }
  }

  /** The turkey: a flat brown body under a fan of tail feathers, head and wattle. */
  function drawTurkey(turkey, elapsed) {
    const cx = turkey.x + turkey.width / 2;
    const base = turkey.y + turkey.height;
    const runCycle = Math.sin(elapsed * 16);
    const airborne = turkey.y + turkey.height < FIELD.groundY - 4;
    // Tail fan.
    for (let index = 0; index < PALETTE.tail.length; index += 1) {
      context.fillStyle = PALETTE.tail[index];
      context.beginPath();
      context.arc(cx - 14, base - 8, turkey.width * (0.58 - index * 0.1), Math.PI * 0.9, Math.PI * 2.05);
      context.fill();
    }
    // Body.
    context.fillStyle = PALETTE.turkeyBody;
    context.beginPath();
    context.ellipse(cx, base - turkey.height * 0.42, turkey.width * 0.34, turkey.height * 0.48, 0, 0, Math.PI * 2);
    context.fill();
    // Belly.
    context.fillStyle = PALETTE.turkeyBelly;
    context.beginPath();
    context.ellipse(cx + 6, base - turkey.height * 0.3, turkey.width * 0.2, turkey.height * 0.3, 0, 0, Math.PI * 2);
    context.fill();
    // Head and beak.
    context.fillStyle = PALETTE.head;
    context.beginPath();
    context.arc(cx + 20, base - turkey.height - 2, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.beak;
    context.beginPath();
    context.moveTo(cx + 30, base - turkey.height - 4);
    context.lineTo(cx + 44, base - turkey.height + 2);
    context.lineTo(cx + 30, base - turkey.height + 6);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.wattle;
    context.fillRect(cx + 28, base - turkey.height + 8, 6, 12);
    // Legs: pumping when running, tucked when flying.
    context.strokeStyle = '#e8912d';
    context.lineWidth = 5;
    context.lineCap = 'round';
    const lift = airborne ? 10 : Math.max(0, runCycle * 8);
    context.beginPath();
    context.moveTo(cx - 8, base - 6);
    context.lineTo(cx - 8 - lift * 0.6, base + 8);
    context.moveTo(cx + 8, base - 6);
    context.lineTo(cx + 8 + lift * 0.6, base + 8);
    context.stroke();
    // A golden feather shield shimmers around the turkey while it lasts.
    if (turkey.shield) {
      context.strokeStyle = 'rgba(242, 230, 255, 0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(cx, base - turkey.height / 2, 52 + Math.sin(elapsed * 6) * 4, 0, Math.PI * 2);
      context.stroke();
    }
  }

  /** The farmer chasing from the left, closer when the gap shrinks. He stays
   *  on screen even at full gap, so the threat is always visible. */
  function drawFarmer(gap, elapsed) {
    const gapPx = Math.max(0, Math.min(FARMER_START_GAP, gap));
    const x = 200 - 60 - gapPx * 3;
    if (x < -90) return;
    const runCycle = Math.sin(elapsed * 16 + 1);
    const base = FIELD.groundY;
    // Legs.
    context.strokeStyle = '#2e2a26';
    context.lineWidth = 7;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x + 20, base - 52);
    context.lineTo(x + 20 - runCycle * 12, base);
    context.moveTo(x + 34, base - 52);
    context.lineTo(x + 34 + runCycle * 12, base);
    context.stroke();
    // Body: blue shirt, arms pumping forward.
    context.fillStyle = PALETTE.farmerShirt;
    context.fillRect(x + 8, base - 104, 44, 54);
    context.strokeStyle = PALETTE.farmerSkin;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(x + 46, base - 96);
    context.lineTo(x + 66 + runCycle * 6, base - 82);
    context.moveTo(x + 46, base - 82);
    context.lineTo(x + 64 - runCycle * 6, base - 68);
    context.stroke();
    // Head and hat.
    context.fillStyle = PALETTE.farmerSkin;
    context.beginPath();
    context.arc(x + 30, base - 118, 15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.farmerHat;
    context.fillRect(x + 12, base - 140, 36, 10);
    context.fillRect(x + 18, base - 156, 24, 18);
    // Angry moustache.
    context.fillStyle = '#3a2c1e';
    context.fillRect(x + 30, base - 112, 16, 5);
  }

  function drawHazard(item) {
    const x = item.x;
    const y = item.y;
    const w = item.width;
    const h = item.height;
    switch (item.name) {
      case 'fence':
        context.fillStyle = '#7a5230';
        context.fillRect(x, y, 8, h);
        context.fillRect(x + w - 8, y, 8, h);
        context.fillRect(x, y + 12, w, 10);
        context.fillRect(x, y + 38, w, 10);
        break;
      case 'haybale':
        context.fillStyle = '#d9a83c';
        roundRect(x, y, w, h, 12);
        context.fill();
        context.strokeStyle = '#a87c22';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x + 8, y + h / 2);
        context.lineTo(x + w - 8, y + h / 2);
        context.stroke();
        break;
      case 'puddle':
        context.fillStyle = '#5a8ec9';
        context.beginPath();
        context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2 + 4, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.5)';
        context.beginPath();
        context.ellipse(x + w / 3, y + h / 2, w / 6, 3, 0, 0, Math.PI * 2);
        context.fill();
        break;
      case 'crate':
        context.fillStyle = '#8a5a2b';
        context.fillRect(x, y, w, h);
        context.strokeStyle = '#5d3a1a';
        context.lineWidth = 4;
        context.strokeRect(x + 2, y + 2, w - 4, h - 4);
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + w, y + h);
        context.moveTo(x + w, y);
        context.lineTo(x, y + h);
        context.stroke();
        break;
      case 'pitchfork': {
        const sway = Math.sin(item.wobble) * 0.12;
        context.save();
        context.translate(x + w / 2, y);
        context.rotate(sway);
        context.strokeStyle = '#c9ced6';
        context.lineWidth = 4;
        for (let tine = -1; tine <= 1; tine += 1) {
          context.beginPath();
          context.moveTo(tine * 10, 0);
          context.lineTo(tine * 10, -26);
          context.stroke();
        }
        context.beginPath();
        context.moveTo(-14, 0);
        context.lineTo(14, 0);
        context.stroke();
        context.strokeStyle = '#7a4a26';
        context.lineWidth = 6;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, h);
        context.stroke();
        context.restore();
        break;
      }
      case 'lantern':
        context.fillStyle = '#3a2c1e';
        context.fillRect(x + w / 2 - 3, y, 6, 14);
        context.fillStyle = '#f2c94c';
        roundRect(x + 4, y + 14, w - 8, h - 14, 8);
        context.fill();
        context.fillStyle = 'rgba(242, 201, 76, 0.35)';
        context.beginPath();
        context.arc(x + w / 2, y + h / 2, 34, 0, Math.PI * 2);
        context.fill();
        break;
      case 'oven':
        context.fillStyle = '#4a4a52';
        roundRect(x, y, w, h, 8);
        context.fill();
        context.fillStyle = '#22222a';
        roundRect(x + 10, y + 34, w - 20, h - 46, 6);
        context.fill();
        context.fillStyle = '#ff7a2d';
        context.beginPath();
        context.arc(x + w / 2, y + h - 16, 12 + Math.sin(item.wobble * 2) * 3, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#c9ced6';
        context.fillRect(x + 14, y + 8, w - 28, 8);
        break;
      case 'knife': {
        const swing = Math.sin(item.wobble) * 0.35;
        context.save();
        context.translate(x + w / 2, y);
        context.rotate(swing);
        context.fillStyle = '#7a4a26';
        context.fillRect(-5, -10, 10, 26);
        context.fillStyle = '#dfe3ea';
        context.beginPath();
        context.moveTo(-11, 16);
        context.lineTo(11, 16);
        context.lineTo(0, h);
        context.closePath();
        context.fill();
        context.restore();
        break;
      }
      case 'rollingpin':
        context.fillStyle = '#c98a4b';
        roundRect(x, y, w, h, h / 2);
        context.fill();
        context.fillStyle = '#8a5a2b';
        context.fillRect(x - 6, y + h / 2 - 4, 10, 8);
        context.fillRect(x + w - 4, y + h / 2 - 4, 10, 8);
        break;
      case 'log':
        context.fillStyle = '#6e4423';
        roundRect(x, y, w, h, h / 2);
        context.fill();
        context.fillStyle = '#a9713a';
        context.beginPath();
        context.arc(x + 10, y + h / 2, h / 2 - 4, 0, Math.PI * 2);
        context.fill();
        break;
      case 'branch':
        context.strokeStyle = '#3e6332';
        context.lineWidth = 10;
        context.beginPath();
        context.moveTo(x, y + h / 2);
        context.lineTo(x + w, y + h / 2);
        context.stroke();
        context.fillStyle = '#5d8a4a';
        for (let leaf = 0; leaf < 4; leaf += 1) {
          context.beginPath();
          context.arc(x + 14 + leaf * 26, y + h / 2 - 8, 14, 0, Math.PI * 2);
          context.fill();
        }
        break;
      case 'thorns':
        context.fillStyle = '#4a3826';
        for (let spike = 0; spike < 6; spike += 1) {
          const sx = x + spike * (w / 6);
          context.beginPath();
          context.moveTo(sx, y + h);
          context.lineTo(sx + w / 12, y);
          context.lineTo(sx + w / 6, y + h);
          context.closePath();
          context.fill();
        }
        break;
      default:
        context.fillStyle = PALETTE.danger;
        context.fillRect(x, y, w, h);
    }
  }

  function drawPickup(item) {
    if (item.kind === KIND_CORN) {
      context.fillStyle = PALETTE.corn;
      context.beginPath();
      context.ellipse(item.x + item.width / 2, item.y + item.height / 2, item.width / 3, item.height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#a87c22';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(item.x + item.width / 2, item.y + 4);
      context.lineTo(item.x + item.width / 2, item.y + item.height - 4);
      context.stroke();
    } else if (item.kind === KIND_FEATHER) {
      const bob = Math.sin(item.wobble) * 6;
      context.save();
      context.translate(item.x + item.width / 2, item.y + item.height / 2 + bob);
      context.rotate(Math.sin(item.wobble * 0.7) * 0.3);
      context.fillStyle = PALETTE.feather;
      context.beginPath();
      context.ellipse(0, 0, 8, 16, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#b9a7d9';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -14);
      context.lineTo(0, 16);
      context.stroke();
      context.restore();
    } else if (item.kind === KIND_HAYSTACK) {
      context.fillStyle = '#d9a83c';
      context.beginPath();
      context.moveTo(item.x, item.y + item.height);
      context.quadraticCurveTo(item.x + item.width / 2, item.y - 20, item.x + item.width, item.y + item.height);
      context.closePath();
      context.fill();
      context.strokeStyle = '#a87c22';
      context.lineWidth = 3;
      for (let line = 0; line < 3; line += 1) {
        context.beginPath();
        context.moveTo(item.x + 18 + line * 30, item.y + item.height - 12);
        context.lineTo(item.x + 30 + line * 30, item.y + 22);
        context.stroke();
      }
      text('HIDE', item.x + item.width / 2, item.y - 12, 20, PALETTE.text, 'center');
    }
  }

  function drawHud(state, best, muted) {
    text(`Score ${state.score}`, 24, 18, 30, PALETTE.text, 'left', 'top');
    text(`${Math.floor(state.distance)} m`, 300, 18, 30, PALETTE.text, 'left', 'top');
    text(state.stage.name, FIELD.width / 2, 18, 30, PALETTE.text, 'center', 'top');
    // Hearts for the stumbles left.
    for (let heart = 0; heart < STUMBLES; heart += 1) {
      const x = FIELD.width - 24 - (STUMBLES - heart) * (HEART + 8);
      context.fillStyle = heart < state.stumbles ? PALETTE.danger : 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.arc(x + 7, 26, 8, 0, Math.PI * 2);
      context.arc(x + 17, 26, 8, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x, 30);
      context.lineTo(x + 24, 30);
      context.lineTo(x + 12, 46);
      context.closePath();
      context.fill();
    }
    // The farmer's gap: a bar that shrinks as he closes in.
    const barX = FIELD.width - 340;
    const barWidth = 220;
    const ratio = Math.max(0, Math.min(1, state.farmerGap / FARMER_START_GAP));
    text('FARMER', barX - 10, 20, 20, ratio < 0.35 ? PALETTE.danger : PALETTE.muted, 'right', 'top');
    context.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(barX, 22, barWidth, 18, 9);
    context.fill();
    context.fillStyle = ratio < 0.35 ? PALETTE.danger : PALETTE.safe;
    if (ratio > 0) {
      roundRect(barX, 22, barWidth * ratio, 18, 9);
      context.fill();
    }
    if (state.turkey.shield) text('SHIELD', barX + barWidth + 12, 20, 20, PALETTE.feather, 'left', 'top');
    if (muted) text('MUTED', 24, 58, 18, PALETTE.muted, 'left', 'top');
    if (best > 0) text(`Best ${best}`, 24, 58, 18, PALETTE.muted, 'left', 'top');
    if (state.hideFlash > 0) {
      text('Hidden in the hay!', FIELD.width / 2, 84, 26, PALETTE.safe, 'center', 'top');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, PANEL.width, height, 16);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.corn, 'center');
  }

  const TITLE_LINES = [
    'Thanksgiving is coming — and you are the dinner.',
    'Run 3000 m from the farmyard to the forest.',
    'Jump the fences, duck the knives, dodge the oven.',
    'Grab corn, hide in haystacks, mind the farmer.',
    '',
  ];
  const PAUSED_LINES = ['The farmer waits. The oven stays hot.'];
  const CAUGHT_LINES = ['', '', 'The farmer caught you — dinner is served.'];
  const ESCAPED_LINES = ['', '', 'You made it to the forest. Free at last!'];

  /** Paint one frame: the backdrop, the farmer, the field, then the HUD or a panel. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawBackdrop(state.stage, state.distance);
    drawFarmer(state.farmerGap, state.elapsed);
    for (let index = 0; index < state.obstacles.length; index += 1) {
      const item = state.obstacles[index];
      if (!item.active) continue;
      if (item.kind === KIND_CORN || item.kind === KIND_FEATHER || item.kind === KIND_HAYSTACK) drawPickup(item);
      else drawHazard(item);
    }
    const turkey = state.turkey;
    // Blink while mercy frames run after a stumble.
    if (turkey.mercy <= 0 || Math.floor(turkey.mercy * 10) % 2 === 1) drawTurkey(turkey, state.elapsed);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = `Best ${best}`;
      drawPanel('GOBBLE DASH', TITLE_LINES, 'Press Space or click to run');
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to keep running');
    else if (screen === SCREEN_OVER_CAUGHT) {
      CAUGHT_LINES[0] = `Score ${state.score}`;
      CAUGHT_LINES[1] = `Distance ${Math.floor(state.distance)} m — Best ${best}`;
      drawPanel('CAUGHT FOR DINNER', CAUGHT_LINES, 'Press Space or click to run again');
    } else if (screen === SCREEN_OVER_ESCAPED) {
      ESCAPED_LINES[0] = `Score ${state.score}`;
      ESCAPED_LINES[1] = `Escaped in ${state.elapsed.toFixed(1)} s — Best ${best}`;
      drawPanel('ESCAPED!', ESCAPED_LINES, 'Press Space or click to run again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
