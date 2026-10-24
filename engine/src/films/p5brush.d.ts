// The p5.brush standalone API the films use (the package ships no types). Colours are CSS strings; lengths in px.
declare module 'p5.brush/standalone' {
  type Pt = [number, number] | [number, number, number];
  export function createCanvas(w: number, h: number, opts?: {parent?: HTMLElement; pixelDensity?: number}): HTMLCanvasElement;
  export function seed(n: number): void;
  export function noiseSeed(n: number): void;
  export function render(): void;
  export function clear(color?: string): void;
  export function push(): void;
  export function pop(): void;
  export function translate(x: number, y: number): void;
  export function rotate(a: number): void;
  export function scale(s: number): void;
  export function angleMode(m: unknown): void;
  export const DEGREES: unknown;
  export const RADIANS: unknown;
  /** brushes: '2B' 'HB' '2H' 'cpencil' 'pen' 'rotring' 'spray' 'marker' 'marker2' 'charcoal' 'hatch_brush' */
  export function set(brush: string, color: string, weight?: number): void;
  export function pick(brush: string): void;
  export function stroke(color: string): void;
  export function strokeWeight(w: number): void;
  export function noStroke(): void;
  /** watercolour fill: opacity 0..255 */
  export function fill(color: string, opacity?: number): void;
  export function fillBleed(strength: number, direction?: 'out' | 'in'): void;
  export function fillTexture(textureStrength?: number, borderIntensity?: number): void;
  export function noFill(): void;
  export function hatch(distance: number, angle: number, options?: {rand?: number; continuous?: boolean; gradient?: number}): void;
  export function hatchStyle(brush: string, color: string, weight?: number): void;
  export function noHatch(): void;
  export function wash(color: string, opacity?: number): void;
  export function noWash(): void;
  export function field(name: string): void;
  export function noField(): void;
  export function wiggle(n: number): void;
  export function line(x1: number, y1: number, x2: number, y2: number): void;
  export function flowLine(x: number, y: number, length: number, dir: number): void;
  export function rect(x: number, y: number, w: number, h: number, mode?: 'center' | 'corner'): void;
  export function circle(x: number, y: number, r: number, irregularity?: boolean): void;
  export function arc(x: number, y: number, r: number, start: number, end: number): void;
  export function polygon(points: Pt[]): void;
  export function spline(points: Pt[], curvature?: number): void;
  export function beginShape(curvature?: number): void;
  export function vertex(x: number, y: number, pressure?: number): void;
  export function endShape(close?: unknown): void;
  export function random(a?: number, b?: number): number;
  export function noise(x: number, y?: number): number;
}
