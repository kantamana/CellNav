import { resolveActive } from "./active";
import type { Spec } from "./cells";
import { createEffect, isSelected, resample, stepWeight, type EffectImpl } from "./effects";
import type { Point } from "./geometry";
import { pathData } from "./render";
import { motions, scenes, type Motion } from "./scene";

// A long gap (a tab that was hidden) must not become one huge step.
const MAX_STEP_MS = 100;

/**
 * Starts the effects in `spec` on a navbar drawn by renderSvg. Each cell has a
 * strength per effect, from 0 to 1, that eases towards 1 while the cell is
 * selected (all, hovered, active, ...) and back to 0 after. Frames are drawn
 * only while something is changing: a hover effect costs nothing until a cell
 * is hovered, and a frozen one is drawn once. It also:
 *   - freezes the clock and skips the easing if the visitor asked to reduce motion,
 *   - pauses while the navbar is off screen,
 *   - restores the plain shapes when stopped.
 * Returns undefined if there is nothing to run.
 */
export function startMotion(svg: SVGSVGElement, spec: Spec, pageUrl?: string): Motion | undefined {
  const scene = scenes.get(svg);
  const effectSpecs = spec.effects ?? [];
  if (!scene || effectSpecs.length === 0) return undefined;

  const seed = typeof spec.layout?.rngSeed === "number" ? spec.layout.rngSeed : 1;
  const effects: EffectImpl[] = effectSpecs.map((s) => createEffect(s, { seed }));
  const items = spec.items;
  const n = scene.cells.length;

  // Straight edges only look wobbly with enough points on them.
  const finest = (uses: (e: EffectImpl) => boolean) => {
    const d = effects.filter(uses).map((e) => e.detail);
    return d.length ? Math.min(...d) : undefined;
  };
  const textDetail = finest((e) => e.text);
  const cellDetail = finest((e) => e.cells);
  const dense = scene.cells.map((cell) => ({
    shape: cellDetail ? resample(cell.shape, cellDetail) : cell.shape,
    ring: cellDetail ? resample(cell.ring, cellDetail) : cell.ring,
    label: textDetail ? cell.label.map((c) => resample(c, textDetail)) : cell.label,
  }));

  const pointer = new Set<number>();
  const focus = new Set<number>();
  const indexOfId = (id: string | undefined) => {
    const i = items.findIndex((it) => it.id === id);
    return i < 0 ? undefined : i;
  };
  let active = indexOfId(
    resolveActive(items, spec.active, pageUrl ?? (typeof location !== "undefined" ? location.href : "")),
  );

  const goals = (): number[][] => {
    const state = { hovered: new Set([...pointer, ...focus]), active };
    return effects.map((e) =>
      Array.from({ length: n }, (_, i) => (isSelected(e.on, i, items, state) ? 1 : 0)),
    );
  };
  // Start settled, so a frozen effect is there on the first paint rather than fading in.
  const weights = goals();

  const moved = (part: "text" | "cells", i: number) =>
    effects.some((e, k) => (part === "text" ? e.text : e.cells) && weights[k]![i]! > 0);

  const displace = (points: Point[], i: number, part: "text" | "cells", seconds: number) =>
    points.map((p) => {
      let x = p.x;
      let y = p.y;
      effects.forEach((e, k) => {
        if (!(part === "text" ? e.text : e.cells)) return;
        const w = weights[k]![i]!;
        if (w <= 0) return;
        const d = e.displace(p, seconds);
        x += d.x * w;
        y += d.y * w;
      });
      return { x, y };
    });

  // Whether each cell's outline/letters were last drawn moved, so they can be put back.
  const outlineMoved = new Array<boolean>(n).fill(false);
  const lettersMoved = new Array<boolean>(n).fill(false);

  const redraw = (i: number, seconds: number) => {
    const node = scene.nodes[i]!;
    const cell = scene.cells[i]!;
    const outline = moved("cells", i);
    if (outline || outlineMoved[i]) {
      const shape = outline ? displace(dense[i]!.shape, i, "cells", seconds) : cell.shape;
      const ring = outline ? displace(dense[i]!.ring, i, "cells", seconds) : cell.ring;
      const d = pathData([shape]);
      node.shape.setAttribute("d", d);
      node.clip?.setAttribute("d", d);
      node.scrim?.setAttribute("d", d);
      node.ring.setAttribute("d", pathData([ring]));
      outlineMoved[i] = outline;
    }
    const letters = moved("text", i);
    if (node.label && (letters || lettersMoved[i])) {
      const contours = letters
        ? dense[i]!.label.map((c) => displace(c, i, "text", seconds))
        : cell.label;
      node.label.setAttribute("d", pathData(contours));
      lettersMoved[i] = letters;
    }
  };

  const reduced =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;
  const begun = typeof performance !== "undefined" ? performance.now() : 0;
  const clock = (now: number) => (reduced?.matches ? 0 : (now - begun) / 1000);

  let frameId = 0;
  let last = 0;
  let visible = true;

  const frame = (now: number) => {
    frameId = 0;
    const dt = Math.min(MAX_STEP_MS, last ? now - last : 16);
    last = now;
    const goal = goals();
    let busy = false;
    effects.forEach((e, k) => {
      for (let i = 0; i < n; i++) {
        const w = stepWeight(weights[k]![i]!, goal[k]![i]!, dt, reduced?.matches ? 0 : e.ease);
        weights[k]![i] = w;
        if (w !== goal[k]![i]! || (e.animated && w > 0)) busy = true;
      }
    });
    const seconds = clock(now);
    for (let i = 0; i < n; i++) redraw(i, seconds);
    if (busy) schedule();
  };
  const schedule = () => {
    if (!frameId && visible) frameId = requestAnimationFrame(frame);
  };
  const kick = () => {
    last = 0;
    schedule();
  };

  // Hover and keyboard focus decide which cells a "hover" effect applies to.
  const links = Array.from(svg.querySelectorAll("a.cn-link"));
  const undo: (() => void)[] = [];
  const listen = (el: Element, type: string, fn: () => void) => {
    el.addEventListener(type, fn);
    undo.push(() => el.removeEventListener(type, fn));
  };
  links.forEach((a, i) => {
    listen(a, "pointerenter", () => (pointer.add(i), kick()));
    listen(a, "pointerleave", () => (pointer.delete(i), kick()));
    listen(a, "focusin", () => (focus.add(i), kick()));
    listen(a, "focusout", () => (focus.delete(i), kick()));
  });
  reduced?.addEventListener?.("change", kick);

  let observer: IntersectionObserver | undefined;
  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1]!.isIntersecting;
      if (visible) kick();
      else if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    });
    observer.observe(svg);
  }

  for (let i = 0; i < n; i++) redraw(i, 0);
  if (effects.some((e, k) => e.animated && weights[k]!.some((w) => w > 0))) kick();

  const motion: Motion = {
    stop() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      undo.forEach((u) => u());
      reduced?.removeEventListener?.("change", kick);
      observer?.disconnect();
      // Put every shape back where it started.
      weights.forEach((row) => row.fill(0));
      for (let i = 0; i < n; i++) redraw(i, 0);
      if (motions.get(svg) === motion) motions.delete(svg);
    },
    setActive(id) {
      active = indexOfId(id);
      kick();
    },
  };
  motions.set(svg, motion);
  return motion;
}
