import type { GameState, Group } from '../game/rules';
import { BALL_COLORS } from '../render/textures';

export interface HudCallbacks {
  onNewGame(): void;
  onToggleView(): void;
  onToggleSound(): boolean;
  onSpinChange(side: number, height: number): void;
}

const GROUP_BALLS: Record<Group, number[]> = {
  solids: [1, 2, 3, 4, 5, 6, 7],
  stripes: [9, 10, 11, 12, 13, 14, 15],
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function chip(id: number, potted: boolean): HTMLElement {
  const c = el('span', 'chip' + (potted ? ' potted' : ''));
  const base = BALL_COLORS[id > 8 ? id - 8 : id];
  c.style.background = id > 8 ? `linear-gradient(#f6f4ec 28%, ${base} 28% 72%, #f6f4ec 72%)` : base;
  c.title = `Ball ${id}`;
  c.append(el('i', undefined, String(id)));
  return c;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement[] = [];
  private readonly message: HTMLElement;
  private readonly powerFill: HTMLElement;
  private readonly spinDot: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly overlayText: HTMLElement;
  private readonly help: HTMLElement;
  private messageTimer = 0;

  constructor(container: HTMLElement, private readonly cb: HudCallbacks) {
    this.root = el('div', 'hud');
    container.append(this.root);

    const players = el('div', 'players');
    for (let i = 0; i < 2; i++) {
      const card = el('div', 'card');
      card.append(el('div', 'name', `Player ${i + 1}`), el('div', 'group'), el('div', 'chips'));
      players.append(card);
      this.cards.push(card);
    }
    this.root.append(players);

    this.message = el('div', 'message');
    this.root.append(this.message);

    const toolbar = el('div', 'toolbar');
    const btn = (label: string, title: string, fn: (b: HTMLButtonElement) => void) => {
      const b = el('button', undefined, label);
      b.title = title;
      b.addEventListener('click', () => fn(b));
      toolbar.append(b);
      return b;
    };
    btn('New game', 'Start a new game', () => cb.onNewGame());
    btn('View', 'Switch between the player view and top view (V)', () => cb.onToggleView());
    btn('Sound: on', 'Toggle sound', (b) => (b.textContent = cb.onToggleSound() ? 'Sound: on' : 'Sound: off'));
    btn('?', 'How to play (H)', () => this.toggleHelp());
    this.root.append(toolbar);

    const power = el('div', 'power');
    this.powerFill = el('div', 'fill');
    power.append(this.powerFill, el('span', 'label', 'Power'));
    this.root.append(power);

    const spin = el('div', 'spin');
    spin.title = 'Where the cue hits the cue ball. Drag to add spin; double-click to reset.';
    const face = el('div', 'face');
    this.spinDot = el('div', 'dot');
    face.append(this.spinDot);
    spin.append(face, el('span', 'label', 'Spin'));
    this.root.append(spin);
    this.bindSpin(face);

    this.overlay = el('div', 'overlay hidden');
    const panel = el('div', 'panel');
    this.overlayText = el('h2');
    const again = el('button', 'primary', 'Play again');
    again.addEventListener('click', () => cb.onNewGame());
    panel.append(this.overlayText, again);
    this.overlay.append(panel);
    this.root.append(this.overlay);

    this.help = el('div', 'overlay hidden');
    const hp = el('div', 'panel help');
    hp.innerHTML = `
      <h2>How to play</h2>
      <ul>
        <li><b>Aim</b>: point at the table. The cue follows the pointer.</li>
        <li><b>Shoot</b>: press, pull back to set power, and release.</li>
        <li><b>Fine aim</b>: ← → (hold Shift for bigger steps). ↑ ↓ set power, Space shoots.</li>
        <li><b>Spin</b>: drag the dot on the cue ball in the bottom right corner.</li>
        <li><b>Camera</b>: right-drag to orbit, scroll to zoom, two fingers on touch. V switches to the top view.</li>
        <li><b>Ball in hand</b>: move the cue ball and click to place it.</li>
      </ul>
      <p>8-ball: pocket all of your group (solids 1–7 or stripes 9–15), then the 8.
      Hitting the other group first, hitting nothing, or scratching is a foul and gives your opponent ball in hand.</p>`;
    const close = el('button', 'primary', 'Got it');
    close.addEventListener('click', () => this.toggleHelp(false));
    hp.append(close);
    this.help.append(hp);
    this.root.append(this.help);
  }

  private bindSpin(face: HTMLElement): void {
    let active = false;
    const set = (e: PointerEvent) => {
      const r = face.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width) * 2 - 1;
      let y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const l = Math.hypot(x, y);
      const max = 0.8;
      if (l > max) {
        x = (x / l) * max;
        y = (y / l) * max;
      }
      this.setSpin(x / max, y / max);
      this.cb.onSpinChange(x / max, y / max);
    };
    face.addEventListener('pointerdown', (e) => {
      active = true;
      face.setPointerCapture(e.pointerId);
      set(e);
    });
    face.addEventListener('pointermove', (e) => active && set(e));
    face.addEventListener('pointerup', () => (active = false));
    face.addEventListener('dblclick', () => {
      this.setSpin(0, 0);
      this.cb.onSpinChange(0, 0);
    });
  }

  /** side and height in −1..1. */
  setSpin(side: number, height: number): void {
    this.spinDot.style.left = `${50 + side * 40}%`;
    this.spinDot.style.top = `${50 - height * 40}%`;
  }

  setPower(p: number): void {
    this.powerFill.style.height = `${Math.round(p * 100)}%`;
  }

  toggleHelp(show?: boolean): void {
    this.help.classList.toggle('hidden', show === undefined ? undefined : !show);
  }

  flash(text: string, ms = 3500): void {
    this.message.textContent = text;
    this.message.classList.add('show');
    clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('show'), ms);
  }

  showGameOver(text: string | null): void {
    this.overlay.classList.toggle('hidden', text === null);
    if (text) this.overlayText.textContent = text;
  }

  render(state: GameState, onTable: ReadonlySet<number>): void {
    this.cards.forEach((card, i) => {
      card.classList.toggle('active', state.current === i && state.winner === null);
      const g = state.groups[i];
      (card.querySelector('.group') as HTMLElement).textContent = g
        ? g === 'solids'
          ? 'Solids'
          : 'Stripes'
        : 'Open table';
      const chips = card.querySelector('.chips') as HTMLElement;
      chips.replaceChildren();
      if (g) {
        const balls = GROUP_BALLS[g];
        for (const id of balls) chips.append(chip(id, !onTable.has(id)));
        const cleared = balls.every((id) => !onTable.has(id));
        chips.append(chip(8, !onTable.has(8) || !cleared));
      }
    });
  }
}
