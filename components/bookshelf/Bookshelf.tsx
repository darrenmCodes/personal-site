"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { Book } from "@/content";
import { coverColour, fixedSwatch, type Swatch } from "./colour";
import type { Shelf3D, ShelfBook } from "./shelf3d";
import styles from "./Bookshelf.module.css";

// Ported from Darren's earlier shelf. A picked book's spine swings back
// 60deg and its cover opens out at 30deg; the rest stand spine-out.
// The shelf never scrolls on its own terms: it always slides to centre the
// open book, so moving along it means opening another one. Click a spine,
// use the ‹ › buttons, or the arrow keys. On desktop, drag the open 3D
// book to turn it; touch does not drag or swipe the shelf.
//
// All of that is still CSS. Once three.js and the model load, shelf3d.ts
// draws real hardbacks in a canvas over the shelf, posed each frame from
// the CSS boxes, and the flat spines and covers turn invisible. Without
// WebGL, or until it loads, the CSS shelf is what you see.
//
// Sizes come from content/index.ts: height follows each cover's shape (the
// tallest book is HEIGHT px), spine width is the book's real thickness from
// its page count, so a 112-page book really is a third of a 386-page one.

const HEIGHT = 220;
const GAP = 4;
// Room past the last book when the shelf is scrolled to its end. A turning
// book briefly reaches past its own slot; without this the last one (pinned
// against the edge, since the shelf can't slide further) got its cover
// squashed and clipped against the edge mid-turn.
const END_ROOM = 28;

// Spines are drawn about 1.6x thicker than true scale against the height,
// enough to fit a title on the thinnest one while keeping every book in
// proportion to the others.
const SPINE_PX_PER_MM = 1.6;
const MIN_SPINE = 14;

// Dragging the open 3D book (mouse only) turns it, easing out towards
// MAX_TURN so it never shows the plain back board, and springs back on release.
const TURN_PER_PX = 0.012; // radians
const MAX_TURN = 0.9; // about 50deg
const DRAG_SLOP = 4; // px before a press counts as a drag, not a click

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Bookshelf({ books }: { books: Book[] }) {
  const [active, setActive] = useState(0);
  const [swatches, setSwatches] = useState<(Swatch | null)[] | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [gl, setGl] = useState<"css" | "3d">("css");
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bookRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const shelfRef = useRef<Shelf3D | null>(null);
  const dragRef = useRef<{ id: number; index: number; x: number; moved: boolean } | null>(null);
  const draggedRef = useRef(false);

  const sizes = useMemo(() => {
    const tallest = Math.max(...books.map((b) => b.heightMm));
    return books.map((b) => {
      const height = (HEIGHT * b.heightMm) / tallest;
      const spine = Math.max(MIN_SPINE, b.thicknessMm * SPINE_PX_PER_MM);
      return { spine, height, cover: (height * b.widthMm) / b.heightMm };
    });
  }, [books]);

  const offsets = useMemo(() => {
    const out: number[] = [];
    for (let i = 0, acc = 0; i < sizes.length; i++) {
      out.push(acc);
      acc += sizes[i].spine + GAP;
    }
    return out;
  }, [sizes]);
  const spinesWidth = sizes.reduce((sum, s) => sum + s.spine + GAP, 0);

  const vw = viewportWidth ?? Infinity;
  const maxScroll = Math.max(0, spinesWidth + sizes[active].cover + END_ROOM - vw);
  const centred = offsets[active] - (vw - (sizes[active].spine + sizes[active].cover)) / 2;
  const scroll = clamp(Number.isFinite(centred) ? centred : 0, 0, maxScroll);
  // Fade whichever edge has books running past it.
  const fadeLeft = scroll > 0.5;
  const fadeRight = scroll < maxScroll - 0.5;
  const hasPrev = active > 0;
  const hasNext = active < books.length - 1;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spines without a hand-picked colour take their cover's most common one,
  // worked out once the shelf is close to the screen.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        Promise.all(books.map((b) => (b.spine ? null : coverColour(b.cover))))
          .then((colours) => {
            if (!cancelled) setSwatches(colours);
          })
          .catch((err: unknown) => console.error("bookshelf: could not colour the spines", err));
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [books]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    let shelf: Shelf3D | null = null;
    let cancelled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const part = (el: Element, cls: string) => {
          const found = el.querySelector<HTMLElement>(`.${cls}`);
          if (!found) throw new Error(`bookshelf: book is missing its .${cls}`);
          return found;
        };
        const input: ShelfBook[] = books.map((b, i) => {
          const el = bookRefs.current[i];
          if (!el) throw new Error(`bookshelf: no element for ${b.slug}`);
          return {
            el,
            spine: part(el, styles.spine),
            cover: part(el, styles.cover),
            title: part(el, styles.spineTitle),
            coverSrc: b.cover,
            heightMm: b.heightMm,
            spinePx: sizes[i].spine,
            heightPx: sizes[i].height,
            coverPx: sizes[i].cover,
          };
        });
        import("./shelf3d")
          .then(({ mountShelf3D }) =>
            mountShelf3D({
              canvas,
              viewport,
              books: input,
              onReady: () => {
                if (!cancelled) setGl("3d");
              },
              onLost: () => setGl("css"),
            }),
          )
          .then((s) => {
            if (cancelled) s.dispose();
            else shelf = shelfRef.current = s;
          })
          .catch((err: unknown) => console.error("bookshelf: 3D shelf failed, keeping the CSS one", err));
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(viewport);
    return () => {
      cancelled = true;
      io.disconnect();
      shelf?.dispose();
      shelfRef.current = null;
    };
  }, [books, sizes]);

  const startTurn = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    draggedRef.current = false;
    // Mouse / pen only — touch taps pick a book and must not fight page scroll.
    if (gl !== "3d" || i !== active || e.button !== 0 || e.pointerType === "touch") return;
    dragRef.current = { id: e.pointerId, index: i, x: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const endTurn = (e: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    dragRef.current = null;
    // The click that follows a drag shouldn't count as picking the book.
    draggedRef.current = drag.moved;
    shelfRef.current?.turn(drag.index, null);
  };

  const moveTurn = (e: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    // Let go outside the window, the release can go missing; a move with no
    // button held means the drag is already over.
    if (e.pointerType === "mouse" && !(e.buttons & 1)) {
      endTurn(e);
      return;
    }
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < DRAG_SLOP) return;
    drag.moved = true;
    shelfRef.current?.turn(drag.index, MAX_TURN * Math.tanh((dx * TURN_PER_PX) / MAX_TURN));
  };

  const go = (i: number) => setActive(clamp(i, 0, books.length - 1));

  // Arrow keys step along the shelf from a book or the ‹ › buttons. Focus
  // follows from a book so the keyboard stays on the open one.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = clamp(active + (e.key === "ArrowRight" ? 1 : -1), 0, books.length - 1);
    go(next);
    if (bookRefs.current.includes(e.target as HTMLButtonElement)) bookRefs.current[next]?.focus({ preventScroll: true });
  };

  const pick = (i: number) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    go(i);
  };

  const current = books[active];

  return (
    <div className={styles.shelf} data-gl={gl} onKeyDown={onKey}>
      <div className={styles.frame} data-fade-left={fadeLeft} data-fade-right={fadeRight}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          style={{ height: HEIGHT }}
          // Tabbing to a book hidden past the edge makes the browser scroll
          // this box natively, which would fight the transform. Undo it.
          onScroll={(e) => {
            e.currentTarget.scrollLeft = 0;
          }}
        >
          <div className={styles.track} style={{ transform: `translate3d(${-scroll}px, 0, 0)`, gap: GAP }}>
            {books.map((b, i) => {
              const s = sizes[i];
              const swatch = b.spine ? fixedSwatch(b.spine) : swatches?.[i];
              const vars = {
                "--spine": `${s.spine}px`,
                "--spine-font": `${s.spine < 24 ? 10 : 12}px`,
                "--cover": `${s.cover}px`,
                "--h": `${s.height}px`,
                "--tone": swatch?.css ?? "#c9b99d",
                "--tone-text": swatch?.text ?? "#2b231d",
              } as CSSProperties;
              return (
                <button
                  key={b.slug}
                  ref={(el) => {
                    bookRefs.current[i] = el;
                  }}
                  type="button"
                  className={styles.book}
                  data-open={i === active}
                  aria-pressed={i === active}
                  // One tab stop for the whole shelf, on the open book; the arrow
                  // keys move along from there.
                  tabIndex={i === active ? 0 : -1}
                  aria-label={`${b.title}${b.author ? `, ${b.author}` : ""}`}
                  style={vars}
                  onClick={() => pick(i)}
                  onPointerDown={(e) => startTurn(e, i)}
                  onPointerMove={moveTurn}
                  onPointerUp={endTurn}
                  onPointerCancel={endTurn}
                  onLostPointerCapture={endTurn}
                >
                  <span className={styles.spine} aria-hidden="true">
                    <span className={styles.spineTitle}>{b.title}</span>
                  </span>
                  <span className={styles.cover} aria-hidden="true">
                    <span className={styles.shine} />
                    {b.cover ? (
                      // Plain img: the covers are already small local WebPs at
                      // display size, so next/image would add nothing.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.cover} alt="" draggable={false} width={Math.round(s.cover)} height={Math.round(s.height)} loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <canvas ref={canvasRef} className={styles.gl} aria-hidden="true" />
      </div>

      <div className={styles.below}>
        <p className={styles.caption}>
          <span className={styles.captionTitle}>
            {current.title}
            {current.author ? `, ${current.author}` : null}
          </span>{" "}
          {current.take ? <Take book={current} /> : null}
        </p>
        <div className={styles.nav}>
          <button type="button" className={styles.step} aria-label="previous book" disabled={!hasPrev} onClick={() => go(active - 1)}>
            ‹
          </button>
          <button type="button" className={styles.step} aria-label="next book" disabled={!hasNext} onClick={() => go(active + 1)}>
            ›
          </button>
        </div>
      </div>

      {/* Print only: on paper the shelf becomes a plain list of every book. */}
      <ol className={styles.printList} aria-hidden="true">
        {books.map((b) => (
          <li key={b.slug}>
            <span className={styles.captionTitle}>
              {b.title}
              {b.author ? `, ${b.author}` : null}
            </span>{" "}
            {b.take ? <Take book={b} /> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

// The take, signed with the month it was read, like a dated margin note.
function Take({ book }: { book: Book }) {
  return (
    <span className={styles.captionTake}>
      {book.take}
      {book.read && book.readLabel ? (
        <>
          {" "}
          <time className={styles.read} dateTime={book.read}>
            {book.readLabel}
          </time>
        </>
      ) : null}
    </span>
  );
}
