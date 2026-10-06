import type { FilmLook } from "@/lib/projector/constants";

type RGB = readonly [number, number, number];

export interface LookParams {
  /** Alpha of each grain speck, either side of neutral. */
  grain: number;
  /** Peak alpha of the exposure drift. Keep tiny: WCAG 2.3.1. */
  flicker: number;
  /** Alpha of the corner darkening at the very corner. */
  vignette: number;
  vignetteTint: RGB;
  /** Peak alpha of each light leak. */
  leak: number;
  leakA: RGB;
  leakB: RGB;
  dust: number;
  /** Constant wash over the whole frame: sunlight, milky fade or lamplight. */
  wash: RGB;
  washAlpha: number;
  /** Gate weave in CSS px. */
  weavePx: number;
}

// Text contrast budget: at the worst point (a corner during a leak peak) these
// alphas still keep body text above 4.5:1. Re-check /test-reel if raising them.
export const LOOKS: Record<FilmLook, LookParams> = {
  sunny: {
    grain: 0.085,
    flicker: 0.022,
    vignette: 0.26,
    vignetteTint: [0.3, 0.17, 0.08],
    leak: 0.24,
    leakA: [1.0, 0.48, 0.24],
    leakB: [1.0, 0.8, 0.42],
    dust: 1,
    wash: [1.0, 0.86, 0.55],
    washAlpha: 0.035,
    weavePx: 0.8,
  },
  faded: {
    grain: 0.1,
    flicker: 0.028,
    vignette: 0.3,
    vignetteTint: [0.38, 0.27, 0.2],
    leak: 0.16,
    leakA: [0.96, 0.6, 0.52],
    leakB: [0.72, 0.86, 0.86],
    dust: 1.2,
    wash: [0.96, 0.92, 0.84],
    washAlpha: 0.09,
    weavePx: 1,
  },
  lateNight: {
    grain: 0.13,
    flicker: 0.018,
    vignette: 0.5,
    vignetteTint: [0.04, 0.02, 0.01],
    leak: 0.2,
    leakA: [1.0, 0.6, 0.24],
    leakB: [0.92, 0.42, 0.18],
    dust: 0.7,
    wash: [1.0, 0.68, 0.32],
    washAlpha: 0.025,
    weavePx: 0.6,
  },
};
