// Input: keyboard + gamepads + touch overlay + virtual (bot/test) input, mapped to
// per-player abstract actions. Sampled once per fixed simulation step via input.poll().
//
//   const p = input.player(0);
//   if (p.pressed('jump')) ...; if (p.held('fire')) ...
//   input.menu.pressed('confirm')
//
// Quick taps that go down and up between two steps are still reported as pressed.

export type Action = 'left' | 'right' | 'up' | 'down' | 'fire' | 'jump' | 'bomb' | 'start';
export const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'down', 'fire', 'jump', 'bomb', 'start'];
export type Bindings = Record<Action, string[]>;
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start';
const MENU_ACTIONS: readonly MenuAction[] = ['up', 'down', 'left', 'right', 'confirm', 'back', 'start'];

export const DEFAULT_BINDINGS: { p1: Bindings; p2: Bindings } = {
  p1: {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    fire: ['KeyJ'],
    jump: ['KeyK'],
    bomb: ['KeyL'],
    start: ['Enter'],
  },
  p2: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    fire: ['Numpad1', 'Comma'],
    jump: ['Numpad2', 'Period'],
    bomb: ['Numpad3', 'Slash'],
    start: ['NumpadEnter', 'ShiftRight'],
  },
};

/** Extra keys for player 1 while player 2 is NOT using the keyboard (classic single-player layout). */
export const SOLO_EXTRA: Bindings = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  fire: ['KeyZ'],
  jump: ['KeyX', 'Space'],
  bomb: ['KeyC'],
  start: ['Escape', 'KeyP'],
};

export type ActionMask = Partial<Record<Action, boolean>>;

/** Per-player action state for the current step. */
export class ActionState {
  private down = new Uint8Array(ACTIONS.length);
  private prev = new Uint8Array(ACTIONS.length);
  private press = new Uint8Array(ACTIONS.length);

  held(a: Action): boolean {
    return this.down[ACTIONS.indexOf(a)] === 1;
  }

  pressed(a: Action): boolean {
    return this.press[ACTIONS.indexOf(a)] === 1;
  }

  released(a: Action): boolean {
    const i = ACTIONS.indexOf(a);
    return this.prev[i] === 1 && this.down[i] === 0;
  }

  /** -1, 0, 1 horizontal direction. */
  get dirX(): -1 | 0 | 1 {
    return ((this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0)) as -1 | 0 | 1;
  }

  get dirY(): -1 | 0 | 1 {
    return ((this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0)) as -1 | 0 | 1;
  }

  /** True if any action was pressed this step. */
  anyPressed(): boolean {
    return this.press.some((v) => v === 1);
  }

  /** Internal: advance one step with new raw state. */
  _step(downNow: boolean[], tapped: boolean[]): void {
    this.prev.set(this.down);
    for (let i = 0; i < ACTIONS.length; i++) {
      const d = downNow[i] || tapped[i];
      this.press[i] = tapped[i] || (d && !this.prev[i]) ? 1 : 0;
      this.down[i] = d ? 1 : 0;
    }
  }

  reset(): void {
    this.down.fill(0);
    this.prev.fill(0);
    this.press.fill(0);
  }
}

/** Menu navigation state with key-repeat for directions. */
export class MenuState {
  private down = new Uint8Array(MENU_ACTIONS.length);
  private press = new Uint8Array(MENU_ACTIONS.length);
  private holdTime = new Float32Array(MENU_ACTIONS.length);
  private repeatAcc = new Float32Array(MENU_ACTIONS.length);

  pressed(a: MenuAction): boolean {
    return this.press[MENU_ACTIONS.indexOf(a)] === 1;
  }

  held(a: MenuAction): boolean {
    return this.down[MENU_ACTIONS.indexOf(a)] === 1;
  }

  anyPressed(): boolean {
    return this.press.some((v) => v === 1);
  }

  _step(downNow: boolean[], dt: number): void {
    for (let i = 0; i < MENU_ACTIONS.length; i++) {
      const wasDown = this.down[i] === 1;
      const isDown = downNow[i];
      let p = isDown && !wasDown;
      const isDir = i < 4;
      if (isDown && wasDown && isDir) {
        this.holdTime[i] += dt;
        if (this.holdTime[i] > 0.38) {
          this.repeatAcc[i] += dt;
          if (this.repeatAcc[i] >= 0.085) {
            this.repeatAcc[i] = 0;
            p = true;
          }
        }
      } else if (!isDown) {
        this.holdTime[i] = 0;
        this.repeatAcc[i] = 0;
      }
      this.press[i] = p ? 1 : 0;
      this.down[i] = isDown ? 1 : 0;
    }
  }

  reset(): void {
    this.down.fill(1); // treat everything as held so nothing fires until released
    this.press.fill(0);
  }
}

interface PadState {
  axes: readonly number[];
  buttons: boolean[];
}

const PAD_DEADZONE = 0.45;

function readPad(gp: Gamepad): PadState {
  return { axes: gp.axes, buttons: gp.buttons.map((b) => b.pressed || b.value > 0.5) };
}

/** Standard-mapping gamepad -> actions. */
function padActions(p: PadState): boolean[] {
  const b = (i: number) => !!p.buttons[i];
  const ax = p.axes[0] ?? 0;
  const ay = p.axes[1] ?? 0;
  return ACTIONS.map((a) => {
    switch (a) {
      case 'left':
        return b(14) || ax < -PAD_DEADZONE;
      case 'right':
        return b(15) || ax > PAD_DEADZONE;
      case 'up':
        return b(12) || ay < -PAD_DEADZONE;
      case 'down':
        return b(13) || ay > PAD_DEADZONE;
      case 'fire':
        return b(2) || b(3) || b(7);
      case 'jump':
        return b(0);
      case 'bomb':
        return b(1) || b(5) || b(4) || b(6);
      case 'start':
        return b(9) || b(8);
    }
  });
}

/** On-screen touch controls (created lazily on first touch). Drives player 1. */
class TouchControls {
  root: HTMLDivElement | null = null;
  state: Record<Action, boolean> = { left: false, right: false, up: false, down: false, fire: false, jump: false, bomb: false, start: false };
  private stickId: number | null = null;
  private stickCenter = { x: 0, y: 0 };
  private knob: HTMLDivElement | null = null;
  private base: HTMLDivElement | null = null;
  enabled = false;

  ensure(): void {
    if (this.root || typeof document === 'undefined') return;
    this.enabled = true;
    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;user-select:none;-webkit-user-select:none;';
    const mkBtn = (label: string, action: Action, css: string) => {
      const b = document.createElement('div');
      b.textContent = label;
      b.style.cssText =
        'position:absolute;border-radius:50%;background:rgba(255,255,255,0.14);border:2px solid rgba(255,255,255,0.35);' +
        'color:rgba(255,255,255,0.8);font:bold 13px monospace;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;' +
        css;
      const on = (e: PointerEvent) => {
        e.preventDefault();
        this.state[action] = true;
        b.style.background = 'rgba(255,220,80,0.35)';
        b.setPointerCapture?.(e.pointerId);
      };
      const off = (e: PointerEvent) => {
        e.preventDefault();
        this.state[action] = false;
        b.style.background = 'rgba(255,255,255,0.14)';
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      root.appendChild(b);
      return b;
    };
    mkBtn('FIRE', 'fire', 'right:24px;bottom:90px;width:78px;height:78px;');
    mkBtn('JUMP', 'jump', 'right:112px;bottom:28px;width:66px;height:66px;');
    mkBtn('BOMB', 'bomb', 'right:22px;bottom:12px;width:58px;height:58px;font-size:11px;');
    mkBtn('II', 'start', 'right:16px;top:12px;width:40px;height:40px;border-radius:8px;');

    const base = document.createElement('div');
    base.style.cssText =
      'position:absolute;left:28px;bottom:28px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.08);' +
      'border:2px solid rgba(255,255,255,0.25);pointer-events:auto;touch-action:none;';
    const knob = document.createElement('div');
    knob.style.cssText =
      'position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.3);pointer-events:none;';
    base.appendChild(knob);
    root.appendChild(base);
    this.base = base;
    this.knob = knob;
    const setStick = (cx: number, cy: number) => {
      const dx = cx - this.stickCenter.x;
      const dy = cy - this.stickCenter.y;
      const len = Math.hypot(dx, dy);
      const max = 45;
      const k = len > max ? max / len : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      const dead = 14;
      const ang = Math.atan2(dy, dx);
      const active = len > dead;
      // 8-way with generous diagonals.
      this.state.right = active && Math.cos(ang) > 0.38;
      this.state.left = active && Math.cos(ang) < -0.38;
      this.state.down = active && Math.sin(ang) > 0.5;
      this.state.up = active && Math.sin(ang) < -0.5;
    };
    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stickId = e.pointerId;
      const r = base.getBoundingClientRect();
      this.stickCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      base.setPointerCapture?.(e.pointerId);
      setStick(e.clientX, e.clientY);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      e.preventDefault();
      setStick(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      knob.style.transform = '';
      this.state.left = this.state.right = this.state.up = this.state.down = false;
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    document.body.appendChild(root);
    this.root = root;
  }

  setVisible(v: boolean): void {
    if (this.root) this.root.style.display = v ? '' : 'none';
  }
}

export class InputManager {
  private keysDown = new Set<string>();
  private keyTapLatch = new Set<string>();
  private started = false;
  bindings: { p1: Bindings; p2: Bindings } = structuredCloneSafe(DEFAULT_BINDINGS);
  /** When true, player 2 is joined and uses the keyboard -> disables P1 solo extras. */
  twoPlayerKeyboard = false;
  private players = [new ActionState(), new ActionState()];
  readonly menu = new MenuState();
  private virtual: (ActionMask | null)[] = [null, null];
  private captureCb: ((code: string) => void) | null = null;
  readonly touch = new TouchControls();
  lastDevice: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';
  /** Gamepad indices assigned to players (by connection order). */
  private padOrder: number[] = [];
  /** Called on the first user gesture (used to unlock audio). */
  onFirstGesture: (() => void) | null = null;
  private gestured = false;
  /** Raw "any input" this step (for attract-mode / press start screens). */
  anyPressedThisStep = false;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    const gameKeys = new Set([
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Space',
      'Tab',
      'Slash',
      'Quote',
      'Backspace',
    ]);
    window.addEventListener('keydown', (e) => {
      this.gesture();
      this.lastDevice = 'keyboard';
      if (this.captureCb) {
        e.preventDefault();
        const cb = this.captureCb;
        this.captureCb = null;
        cb(e.code);
        return;
      }
      if (gameKeys.has(e.code) || e.code.startsWith('Numpad')) e.preventDefault();
      if (!e.repeat) this.keyTapLatch.add(e.code);
      this.keysDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keysDown.clear();
    });
    window.addEventListener('pointerdown', (e) => {
      this.gesture();
      if (e.pointerType === 'touch') {
        this.lastDevice = 'touch';
        this.touch.ensure();
      }
    });
    window.addEventListener('gamepadconnected', (e) => {
      const ge = e as GamepadEvent;
      if (!this.padOrder.includes(ge.gamepad.index)) this.padOrder.push(ge.gamepad.index);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      const ge = e as GamepadEvent;
      this.padOrder = this.padOrder.filter((i) => i !== ge.gamepad.index);
    });
  }

  private gesture(): void {
    if (!this.gestured) {
      this.gestured = true;
      this.onFirstGesture?.();
    } else {
      this.onFirstGesture?.(); // harmless re-resume (e.g. after tab switch)
    }
  }

  player(i: number): ActionState {
    return this.players[i] ?? this.players[0];
  }

  /** Bot / test input for a player (OR'ed with real input). Pass null to clear. */
  setVirtual(i: number, mask: ActionMask | null): void {
    this.virtual[i] = mask;
  }

  /** Next key press is delivered to cb (for remapping UI). */
  captureKey(cb: (code: string) => void): void {
    this.captureCb = cb;
  }

  cancelCapture(): void {
    this.captureCb = null;
  }

  get capturing(): boolean {
    return this.captureCb !== null;
  }

  /** True if any gamepad is connected. */
  hasGamepad(): boolean {
    return this.pads().some(Boolean);
  }

  private pads(): (Gamepad | null)[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    try {
      return Array.from(navigator.getGamepads());
    } catch {
      return [];
    }
  }

  private keyActions(b: Bindings, tapped: boolean): boolean[] {
    const set = tapped ? this.keyTapLatch : this.keysDown;
    return ACTIONS.map((a) => b[a].some((k) => set.has(k)));
  }

  /** Sample all devices. Call exactly once per fixed simulation step. */
  poll(dt: number): void {
    const pads = this.pads().filter((p): p is Gamepad => !!p && p.connected);
    // Maintain stable order of pads.
    for (const p of pads) if (!this.padOrder.includes(p.index)) this.padOrder.push(p.index);
    const orderedPads = this.padOrder.map((i) => pads.find((p) => p.index === i)).filter((p): p is Gamepad => !!p);
    const padStates = orderedPads.map((p) => padActions(readPad(p)));
    if (padStates.some((s) => s.some(Boolean))) {
      this.lastDevice = 'gamepad';
      this.gesture();
    }

    const n = ACTIONS.length;
    let anyRaw = false;
    for (let pi = 0; pi < 2; pi++) {
      const b = pi === 0 ? this.bindings.p1 : this.bindings.p2;
      const down = this.keyActions(b, false);
      const tap = this.keyActions(b, true);
      if (pi === 0 && !this.twoPlayerKeyboard) {
        const d2 = this.keyActions(SOLO_EXTRA, false);
        const t2 = this.keyActions(SOLO_EXTRA, true);
        for (let i = 0; i < n; i++) {
          down[i] = down[i] || d2[i];
          tap[i] = tap[i] || t2[i];
        }
      }
      const pad = padStates[pi];
      if (pad) for (let i = 0; i < n; i++) down[i] = down[i] || pad[i];
      if (pi === 0 && this.touch.enabled) {
        for (let i = 0; i < n; i++) down[i] = down[i] || this.touch.state[ACTIONS[i]];
      }
      const v = this.virtual[pi];
      if (v) for (let i = 0; i < n; i++) down[i] = down[i] || !!v[ACTIONS[i]];
      this.players[pi]._step(down, tap);
      if (this.players[pi].anyPressed()) anyRaw = true;
    }

    // Menu: union of everything.
    const has = (codes: string[]) => codes.some((c) => this.keysDown.has(c) || this.keyTapLatch.has(c));
    const any = (fn: (s: ActionState) => boolean) => this.players.some(fn);
    const padAny = (i: number) => padStates.some((s) => s[i]);
    const ai = (a: Action) => ACTIONS.indexOf(a);
    const menuDown = MENU_ACTIONS.map((m) => {
      switch (m) {
        case 'up':
          return any((s) => s.held('up')) || padAny(ai('up'));
        case 'down':
          return any((s) => s.held('down')) || padAny(ai('down'));
        case 'left':
          return any((s) => s.held('left')) || padAny(ai('left'));
        case 'right':
          return any((s) => s.held('right')) || padAny(ai('right'));
        case 'confirm':
          return has(['Enter', 'Space', 'NumpadEnter']) || any((s) => s.held('fire') || s.held('jump')) || padAny(ai('jump')) || padAny(ai('fire'));
        case 'back':
          return has(['Escape', 'Backspace']) || any((s) => s.held('bomb')) || padAny(ai('bomb'));
        case 'start':
          return has(['Enter', 'Escape', 'NumpadEnter', 'KeyP']) || any((s) => s.held('start')) || padAny(ai('start'));
      }
    });
    this.menu._step(menuDown, dt);
    this.anyPressedThisStep = anyRaw || this.keyTapLatch.size > 0;
    this.keyTapLatch.clear();
  }

  /** Clear all edge state (e.g. when switching scenes so a held button doesn't re-trigger). */
  flush(): void {
    this.players.forEach((p) => p.reset());
    this.menu.reset();
    this.keyTapLatch.clear();
  }

  resetBindings(): void {
    this.bindings = structuredCloneSafe(DEFAULT_BINDINGS);
  }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Human readable key name for UI. */
export function keyLabel(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    ShiftLeft: 'LSHIFT',
    ShiftRight: 'RSHIFT',
    ControlLeft: 'LCTRL',
    ControlRight: 'RCTRL',
    AltLeft: 'LALT',
    AltRight: 'RALT',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    Backspace: 'BKSP',
    NumpadEnter: 'NUM ENT',
    Tab: 'TAB',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6);
  return code.toUpperCase();
}

export const input = new InputManager();
