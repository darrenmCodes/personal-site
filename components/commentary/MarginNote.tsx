import type { CSSProperties, ReactNode } from "react";
import styles from "./MarginNote.module.css";

interface MarginNoteProps {
  children: ReactNode;
  /** Positioning class from the parent; the parent must be position: relative. */
  className?: string;
  tilt?: number;
}

// Only visible when the projector's Commentary switch is on. Pure CSS, so it
// costs nothing when off and is hidden from screen readers along with it.
export function MarginNote({ children, className, tilt = -3 }: MarginNoteProps) {
  return (
    <aside
      className={`${styles.note} ${className ?? ""}`}
      style={{ "--tilt": `${tilt}deg` } as CSSProperties}
    >
      <span className="visually-hidden">Commentary: </span>
      {children}
    </aside>
  );
}
