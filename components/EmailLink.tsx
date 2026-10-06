"use client";

import type { ReactNode } from "react";
import styles from "./EmailLink.module.css";

// The markup only ever holds the "(dot)" form so scrapers reading the HTML
// don't get a clean address. Clicking puts the real one together and opens
// the visitor's mail app.
export function EmailLink({ address, children }: { address: string; children?: ReactNode }) {
  const open = () => {
    window.location.href = `mailto:${address.replace(/\s*\(dot\)\s*/gi, ".")}`;
  };
  return (
    <button type="button" className={styles.email} onClick={open}>
      {children ?? address}
    </button>
  );
}
