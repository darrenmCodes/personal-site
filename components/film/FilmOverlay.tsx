"use client";

import { useEffect, useRef, useState } from "react";
import { LOOKS } from "@/lib/film/looks";
import { createFilmRenderer } from "@/lib/film/renderer";
import { motionAllowed, projectorStore } from "@/lib/projector/store";
import { REEL_ID } from "./reel";
import styles from "./FilmOverlay.module.css";

const FPS = 18;
const FRAME_MS = 1000 / FPS;
const SPROCKET_FADE_MS = 600;
const SPROCKET_HOLD_MS = 4200;

function nextSprocketAt(now: number) {
  return now + 18_000 + Math.random() * 22_000;
}

export function FilmOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createFilmRenderer(canvas);
    if (!renderer) {
      setFallback(true);
      return;
    }

    const reel = document.getElementById(REEL_ID);
    const t0 = performance.now();
    let raf = 0;
    let running = false;
    let contextLost = false;
    let lastFrameAt = 0;
    let frame = 0;
    let sprocketStart = nextSprocketAt(t0);

    const sprocketEnvelope = (now: number) => {
      const t = now - sprocketStart;
      const total = SPROCKET_FADE_MS * 2 + SPROCKET_HOLD_MS;
      if (t < 0) return 0;
      if (t > total) {
        sprocketStart = nextSprocketAt(now);
        return 0;
      }
      const v = Math.min(1, t / SPROCKET_FADE_MS, (total - t) / SPROCKET_FADE_MS);
      // Quantise so it snaps in over a few frames rather than fading smoothly.
      return Math.round(v * 4) / 4;
    };

    const setWeave = (x: number, y: number) => {
      if (reel) reel.style.transform = x === 0 && y === 0 ? "" : `translate(${x}px, ${y}px)`;
    };

    const draw = (now: number) => {
      const s = projectorStore.get();
      const look = LOOKS[s.look];
      const moving = running;
      renderer.draw({
        time: moving ? (now - t0) / 1000 : 0,
        frame: moving ? frame : 0,
        motion: moving,
        sprocket: moving ? sprocketEnvelope(now) : 0,
        look,
      });
      if (!moving) return;
      // Gate weave: a slow wander with a little per-frame jitter, snapped to
      // device pixels so text never sits between them and blurs.
      const t = (now - t0) / 1000;
      const dpr = window.devicePixelRatio || 1;
      const snap = (v: number) => Math.round(v * dpr) / dpr;
      const wx = (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.1) * 0.25 + (Math.random() - 0.5) * 0.3) * look.weavePx;
      const wy = (Math.sin(t * 1.1 + 2) * 0.35 + (Math.random() - 0.5) * 0.2) * look.weavePx;
      setWeave(snap(wx), snap(wy));
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastFrameAt < FRAME_MS) return;
      lastFrameAt = now;
      frame += 1;
      draw(now);
    };

    const sync = () => {
      if (contextLost) return;
      const shouldRun = motionAllowed(projectorStore.get()) && document.visibilityState === "visible";
      if (shouldRun && !running) {
        running = true;
        raf = requestAnimationFrame(tick);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
        setWeave(0, 0);
      }
      // Held still: one clean static frame so the look still applies.
      if (!running) draw(performance.now());
    };

    const resize = () => {
      if (contextLost) return;
      renderer.resize(window.innerWidth, window.innerHeight);
      if (!running) draw(performance.now());
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      running = false;
      cancelAnimationFrame(raf);
      setWeave(0, 0);
      console.warn("film: WebGL context lost, switching to CSS grain");
      setFallback(true);
    };

    resize();
    sync();
    const unsubscribe = projectorStore.subscribe(sync);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      setWeave(0, 0);
      renderer.dispose();
    };
  }, []);

  if (fallback) return <div className={styles.fallback} aria-hidden="true" />;
  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
