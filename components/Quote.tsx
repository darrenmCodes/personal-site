"use client";

import { useSyncExternalStore } from "react";
import quotes from "@/content/quotes.json";
import styles from "./Quote.module.css";

const LAST_KEY = "dm:quote:last";

interface QuoteEntry {
  text: string;
  author: string;
  work: string;
  locator: string;
  translator: string;
}

const QUOTES: readonly QuoteEntry[] = quotes;

// Picked once per page load, never the same as last visit's.
let picked: number | null = null;

function pick(): number {
  if (picked !== null) return picked;
  let last = -1;
  try {
    last = Number(window.localStorage.getItem(LAST_KEY) ?? -1);
  } catch (err) {
    console.warn("quote: could not read last quote", err);
  }
  let i = Math.floor(Math.random() * Math.max(1, QUOTES.length - 1));
  if (QUOTES.length > 1 && last >= 0 && i >= last) i += 1;
  picked = i;
  try {
    window.localStorage.setItem(LAST_KEY, String(i));
  } catch (err) {
    console.warn("quote: could not remember this quote", err);
  }
  return i;
}

const noopSubscribe = () => () => {};

// The whole quote sits in double quotes, so speech inside it drops to single
// quotes, as a book would set it, and apostrophes are curled. Wording is
// untouched.
const nest = (text: string) => text.replace(/'/g, "’").replace(/"([^"]*)"/g, "‘$1’");

export function Quote() {
  const index = useSyncExternalStore(noopSubscribe, pick, () => null);
  const q = index === null ? null : QUOTES[index];
  return (
    <figure className={styles.quote}>
      {q ? (
        <>
          <blockquote>
            <p>“{nest(q.text)}”</p>
          </blockquote>
          <figcaption>
            {q.author}, <cite>{q.work}</cite> {q.locator}. trans. {q.translator}.
          </figcaption>
        </>
      ) : null}
    </figure>
  );
}
