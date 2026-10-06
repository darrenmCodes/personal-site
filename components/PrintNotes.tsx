"use client";

import { useEffect, useRef } from "react";
import styles from "./PrintNotes.module.css";

// Links can't be clicked on paper, so in print each external link gets a
// footnote number and its address is listed at the end. Built from the
// links actually on the page, once on load and again just before printing,
// so the numbers can't drift from what's shown. Hidden on screen.
export function PrintNotes() {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const build = () => {
      const list = listRef.current;
      if (!list) return;
      // One number per address: a site linked twice shares its footnote.
      const numbers = new Map<string, string>();
      for (const a of document.querySelectorAll<HTMLAnchorElement>("main a[href^='http']")) {
        if (!numbers.has(a.href)) numbers.set(a.href, String(numbers.size + 1));
        a.dataset.note = numbers.get(a.href);
      }
      list.replaceChildren(
        ...[...numbers].map(([href, n]) => {
          const item = document.createElement("li");
          const num = document.createElement("span");
          num.textContent = n;
          const address = document.createElement("span");
          address.textContent = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
          item.append(num, address);
          return item;
        }),
      );
    };
    build();
    window.addEventListener("beforeprint", build);
    return () => window.removeEventListener("beforeprint", build);
  }, []);

  return (
    <section className={styles.notes} aria-hidden="true">
      <h2 className={styles.label}>links</h2>
      <ol ref={listRef} className={styles.list} />
    </section>
  );
}
