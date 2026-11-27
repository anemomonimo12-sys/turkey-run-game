// Gobble Dash — every tuning number, stage and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The turkey runs from the
// farmyard, through the barn and the kitchen, to the forest: 3000 metres to freedom.

export const FIELD = { width: 1280, height: 720, groundY: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres the turkey must cover to escape into the forest and win. */
export const ESCAPE_DISTANCE = 3000;

/** The farmer starts this far behind (metres) and closes in on every stumble.
 *  28 m (was 26): a perfect autopilot escaped without losing a life, so the
 *  opening gap gives a human player two extra metres of breathing room. */
export const FARMER_START_GAP = 28;

export const TURKEY = {
  x: 200,
  width: 64,
  height: 54,
  /** Pixels per second the world scrolls at the start; it grows with distance. */
  startSpeed: 330,
  speedPerMetre: 0.075,
  maxSpeed: 560,
  jumpVelocity: 1000,
  gravity: 2000,
  /** How long (seconds) after leaving the ground a jump still counts. */
  coyoteTime: 0.12,
  /** Seconds of mercy after a stumble, during which the turkey cannot be hurt again. */
  stumbleMercy: 1.6,
  duckHeight: 30,
};

export const STUMBLES = 3;

export const OBSTACLE = {
  /** Seconds between spawns at the start; shrinks as the run goes on. */
  interval: 1.45,
  intervalMin: 1.15,
  /** How much the interval shrinks per 500 m covered. */
  intervalPer500m: 0.06,
  /** Chance a spawn is a collectible instead of a hazard. */
  cornChance: 0.34,
  featherChance: 0.07,
};

/** What each stage throws at the turkey. */
export const STAGES = [
  {
    name: 'Farmyard',
    from: 0,
    hazards: ['fence', 'haybale', 'puddle'],
    sky: '#f7c873',
    far: '#e8a04c',
    near: '#c97e2e',
    ground: '#8a5a2b',
    groundTop: '#a9713a',
  },
  {
    name: 'The Barn',
    from: 600,
    hazards: ['crate', 'pitchfork', 'lantern'],
    sky: '#e8975a',
    far: '#b96a33',
    near: '#8a4a22',
    ground: '#6e4423',
    groundTop: '#8a5a2e',
  },
  {
    name: 'The Kitchen',
    from: 1400,
    hazards: ['oven', 'knife', 'rollingpin'],
    sky: '#d97b4f',
    far: '#9c4a30',
    near: '#6e3120',
    ground: '#5a2e20',
    groundTop: '#7a4030',
  },
  {
    name: 'The Forest',
    from: 2200,
    hazards: ['log', 'branch', 'thorns'],
    sky: '#8fb573',
    far: '#5d8a4a',
    near: '#3e6332',
    ground: '#4a3826',
    groundTop: '#5d4a30',
  },
];

/** Hazard shapes: height above ground, whether the turkey ducks under it, points for clearing it. */
export const HAZARDS = {
  fence: { width: 34, height: 74, duckUnder: false, clearPoints: 5 },
  haybale: { width: 66, height: 56, duckUnder: false, clearPoints: 5 },
  puddle: { width: 96, height: 12, duckUnder: false, clearPoints: 3 },
  crate: { width: 62, height: 62, duckUnder: false, clearPoints: 5 },
  pitchfork: { width: 30, height: 108, duckUnder: true, clearPoints: 8 },
  lantern: { width: 40, height: 44, duckUnder: true, clearPoints: 8 },
  oven: { width: 84, height: 92, duckUnder: false, clearPoints: 10 },
  knife: { width: 26, height: 118, duckUnder: true, clearPoints: 10 },
  rollingpin: { width: 84, height: 30, duckUnder: false, clearPoints: 8 },
  log: { width: 92, height: 44, duckUnder: false, clearPoints: 5 },
  branch: { width: 110, height: 40, duckUnder: true, clearPoints: 8 },
  thorns: { width: 80, height: 34, duckUnder: false, clearPoints: 6 },
};

export const CORN = { width: 26, height: 26, points: 10 };
export const FEATHER = { width: 30, height: 30, points: 50 };
/** A haystack is a safe spot: running through one refills the farmer gap and grants mercy. */
export const HAYSTACK = { width: 110, height: 84, gapRefill: 10, mercy: 2.0 };

/** How many obstacles and pickups can exist at once; the pools are allocated once, at boot. */
export const POOL_SIZE = 48;

export const PALETTE = {
  backdrop: '#241a12',
  turkeyBody: '#8a5230',
  turkeyBelly: '#c98a4b',
  tail: ['#a0522d', '#d2691e', '#e8a33c', '#f2c94c'],
  head: '#e8dcc8',
  beak: '#e8912d',
  wattle: '#e5534b',
  farmerHat: '#5a4632',
  farmerShirt: '#3e6b8e',
  farmerSkin: '#e8b98a',
  corn: '#f2c94c',
  feather: '#f2e6ff',
  panel: 'rgba(32, 20, 12, 0.92)',
  panelEdge: '#e8a33c',
  text: '#fff3dd',
  muted: '#d9c1a0',
  danger: '#e5534b',
  safe: '#7fc96b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-dash.best';
