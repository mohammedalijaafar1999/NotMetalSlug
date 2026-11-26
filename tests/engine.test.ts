import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/game/terrain';
import { PixelArt, parseColor } from '../src/engine/pixelart';
import { expandRepeats, noteToMidi, parseChannel, renderSfxSamples } from '../src/engine/audio';
import { Rng } from '../src/engine/rng';
import { segmentRect, rotateTowards, angleDiff } from '../src/engine/math';
import { makeWorld, step } from './helpers';
import { Player } from '../src/game/player';
import * as inputMod from '../src/engine/input';

describe('terrain', () => {
  const T = new Terrain(1000, 300);
  T.addSurface(0, 200, 400, 200, { ground: true });
  T.addSurface(400, 200, 500, 150, { ground: true });
  T.addSurface(500, 150, 700, 150, { ground: true });
  T.addSurface(100, 120, 200, 120, { oneWay: true });
  T.addSolid(600, 110, 40, 40);

  it('finds ground and slope heights', () => {
    expect(T.groundTopAt(10)).toBe(200);
    expect(T.groundTopAt(450)).toBeCloseTo(175);
    expect(T.groundTopAt(800)).toBe(Infinity);
  });
  it('finds highest floor in range', () => {
    expect(T.floorAt(150, 100, 250)?.y).toBe(120);
    expect(T.floorAt(150, 121, 250)?.y).toBe(200);
    expect(T.floorAt(150, 100, 250, { noOneWay: true })?.y).toBe(200);
    expect(T.floorAt(620, 0, 300)?.solid).toBeTruthy();
  });
  it('solid points', () => {
    expect(T.isSolidPoint(10, 210)).toBe(true);
    expect(T.isSolidPoint(10, 190)).toBe(false);
    expect(T.isSolidPoint(610, 120)).toBe(true);
    expect(T.isSolidPoint(150, 121)).toBe(false); // platforms are not solid
  });
});

describe('pixelart', () => {
  it('draws primitives and outlines', () => {
    const p = new PixelArt(16, 16);
    p.circle(8, 8, 4, '#ff0000');
    const n = p.opaqueCount();
    expect(n).toBeGreaterThan(30);
    p.outline('#000000');
    expect(p.opaqueCount()).toBeGreaterThan(n);
    expect(parseColor('#ff0000')).toBe(0xff0000ff);
  });
  it('mirror flips horizontally', () => {
    const p = new PixelArt(8, 2);
    p.mirror = true;
    p.px(0, 0, '#ffffff');
    expect(p.opaque(7, 0)).toBe(true);
  });
});

describe('audio parsing', () => {
  it('expands repeats and parses notes', () => {
    expect(expandRepeats('(a b)*2 c').trim().split(/\s+/)).toEqual(['a', 'b', 'a', 'b', 'c']);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#4')).toBe(61);
    const ch = parseChannel({ inst: 'pulse', notes: 'C4 - . E4:2 | G4' });
    expect(ch.length).toBe(6);
    expect(ch.events.map((e) => e.len)).toEqual([2, 2, 1]);
    expect(() => parseChannel({ inst: 'pulse', notes: 'H4' })).toThrow();
    const dr = parseChannel({ inst: 'drums', notes: 'k . s k+h' });
    expect(dr.events.length).toBe(3);
  });
  it('renders sfx without NaN', () => {
    const s = renderSfxSamples([{ wave: 'noise', freq: 3000, freqEnd: 100, dur: 0.2, lowpass: 2000 }, { wave: 'square', freq: 440, dur: 0.1, arp: [0, 4, 7] }], 22050);
    expect(s.length).toBeGreaterThan(4000);
    expect(s.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
  });
});

describe('math & rng', () => {
  it('rng is deterministic', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });
  it('segment vs rect', () => {
    expect(segmentRect(0, 5, 20, 5, { x: 10, y: 0, w: 4, h: 10 })).toBeCloseTo(0.5);
    expect(segmentRect(0, 50, 20, 50, { x: 10, y: 0, w: 4, h: 10 })).toBe(-1);
  });
  it('angles', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(rotateTowards(0, 1, 0.25)).toBeCloseTo(0.25);
  });
});

describe('player physics (sandbox)', () => {
  it('lands on the ground, walks, jumps and stays in camera', () => {
    const w = makeWorld('sandbox');
    step(w, 120);
    const p = w.players[0] as Player;
    expect(p.state).toBe('play');
    expect(p.onGround).toBe(true);
    expect(p.y).toBeCloseTo(180, 0);
    // Jump.
    p.inputOverride = null;
    const input = inputMod.input;
    input.setVirtual(0, { jump: true });
    step(w, 2);
    input.setVirtual(0, { jump: true });
    step(w, 10);
    expect(p.y).toBeLessThan(170);
    input.setVirtual(0, null);
    step(w, 90);
    expect(p.onGround).toBe(true);
    // Walk right.
    input.setVirtual(0, { right: true });
    step(w, 120);
    input.setVirtual(0, null);
    expect(p.x).toBeGreaterThan(150);
  });
});
