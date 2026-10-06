"use client";

import { useSyncExternalStore } from "react";
import { projectorStore } from "@/lib/projector/store";
import styles from "./page.module.css";

interface Pair {
  label: string;
  fg: string;
  bg: string;
  /** Large text (24px+, or 19px bold) only needs 3:1. */
  large?: boolean;
}

const PAIRS: Pair[] = [
  { label: "Body on page", fg: "--fg", bg: "--bg" },
  { label: "Muted on page", fg: "--fg-muted", bg: "--bg" },
  { label: "Body on sunk panel", fg: "--fg", bg: "--bg-sunk" },
  { label: "Muted on sunk panel", fg: "--fg-muted", bg: "--bg-sunk" },
  { label: "Margin note on page", fg: "--scribble", bg: "--bg", large: true },
  { label: "Ink on sky", fg: "--c-ink", bg: "--c-sky" },
  { label: "Ink on grass", fg: "--c-ink", bg: "--c-grass" },
  { label: "Ink on coral", fg: "--c-ink", bg: "--c-coral" },
  { label: "Ink on peach", fg: "--c-ink", bg: "--c-peach" },
  { label: "Focus ring on page", fg: "--focus", bg: "--bg", large: true },
];

interface Row extends Pair {
  ratio: number;
  pass: boolean;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// A probe element resolves var() chains to a concrete rgb() for us.
function resolveColour(probe: HTMLElement, token: string): [number, number, number] | null {
  probe.style.color = `var(${token})`;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(probe).color);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return hexToRgb(getComputedStyle(probe).color);
}

const cache = new Map<string, Row[]>();

function rowsForCurrentLook(): Row[] {
  const look = projectorStore.get().look;
  const hit = cache.get(look);
  if (hit) return hit;
  const probe = document.createElement("span");
  document.body.appendChild(probe);
  const rows = PAIRS.map((pair) => {
    const fg = resolveColour(probe, pair.fg);
    const bg = resolveColour(probe, pair.bg);
    if (!fg || !bg) {
      console.warn(`contrast lab: could not resolve ${pair.fg} or ${pair.bg}`);
      return { ...pair, ratio: 0, pass: false };
    }
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    return { ...pair, ratio, pass: ratio >= (pair.large ? 3 : 4.5) };
  });
  probe.remove();
  cache.set(look, rows);
  return rows;
}

const noRows = () => null;

export function ContrastLab() {
  const rows = useSyncExternalStore(projectorStore.subscribe, rowsForCurrentLook, noRows);

  return (
    <table className={styles.contrast}>
      <caption className="visually-hidden">Contrast ratios for the current film stock</caption>
      <thead>
        <tr>
          <th scope="col">Pair</th>
          <th scope="col">Ratio</th>
          <th scope="col">Needs</th>
          <th scope="col">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {rows === null ? (
          <tr>
            <td colSpan={4}>Threading the projector…</td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">
                <span
                  className={styles.contrastChip}
                  style={{ background: `var(${r.bg})`, color: `var(${r.fg})` }}
                  aria-hidden="true"
                >
                  Aa
                </span>
                {r.label}
              </th>
              <td>{r.ratio.toFixed(2)}</td>
              <td>{r.large ? "3.0" : "4.5"}</td>
              <td data-pass={r.pass}>{r.pass ? "Grand" : "Fails"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
