import fetched from "./books.json";
import site from "./site.json";

// All words live in content/*.json. This file adds types and works out each
// book's physical size. A null name or href means Darren hasn't filled it in
// yet; the page shows a visible TODO instead.

export interface Project {
  name: string | null;
  todo?: string;
  description: string;
  href: string | null;
  /** A footnote on the name, printed at the foot of the page. */
  note?: string;
}

export interface Link {
  label: string;
  href: string | null;
}

/** As written in site.json. */
interface BookEntry {
  title: string;
  author: string | null;
  /** One line on what you made of it. */
  take: string | null;
  /** Spine colour as #rrggbb, picked from the cover by eye. Without it the
   *  shelf uses the cover's most common colour. */
  spine?: string;
  /** When you read it, as YYYY-MM. Signs the take; leave out to show none. */
  read?: string;
  isbn?: string;
  /** Open Library cover id, when the edition's first scan is poor. */
  coverId?: number;
  pages?: number;
  heightMm?: number;
}

/** As written by scripts/fetch-books.mjs. */
interface FetchedBook {
  pages: number | null;
  heightMm: number | null;
  cover: string | null;
  coverPx: { width: number; height: number } | null;
}

export interface Book extends Omit<BookEntry, "pages" | "heightMm"> {
  slug: string;
  cover: string | null;
  pages: number | null;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  /** `read` written out, e.g. "oct 2025". */
  readLabel: string | null;
}

export interface Now {
  /** ISO date, YYYY-MM-DD. */
  updated: string | null;
  working: string | null;
  reading: string | null;
  listening: string | null;
}

interface Site {
  name: string;
  origin: string;
  /** YYYY-MM. Shown only as an age, wherever the bio says {age}. */
  born: string;
  /** Three or four short lines. */
  bio: string[];
  /** Words in the bio to link, e.g. { "meta-flux": "https://meta-flux.com" }. */
  bioLinks: Record<string, string>;
  now: Now;
  made: Project[];
  shelf: { books: BookEntry[] };
  /** Written as name@domain(dot)com. The real address never reaches the
   *  page; components/EmailLink.tsx assembles it only when clicked. */
  email: string | null;
  elsewhere: Link[];
  contact: string;
  colophon: string;
  /** Words in the colophon to link, as with bioLinks. */
  colophonLinks: Record<string, string>;
}

// Keep in step with slug() in scripts/fetch-books.mjs.
const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Paperback stock is roughly 0.065 mm a page (pages, not leaves), plus about
// 2 mm for the two covers. A B-format paperback is 129 mm wide.
const MM_PER_PAGE = 0.065;
const COVERS_MM = 2;
const DEFAULT_WIDTH_MM = 129;
const DEFAULT_ASPECT = 129 / 198;
const DEFAULT_THICKNESS_MM = 20;

// Written out by hand rather than with Intl/Date: "2025-10" parsed as a date
// is midnight UTC, which some timezones would show as the month before.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function readLabel(entry: BookEntry): string | null {
  if (entry.read === undefined) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(entry.read);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) throw new Error(`site.json: "${entry.title}" has read "${entry.read}", expected YYYY-MM`);
  return `${month} ${m[1]}`;
}

function measure(entry: BookEntry, data: FetchedBook | undefined): Book {
  if (entry.spine !== undefined && !/^#[0-9a-f]{6}$/i.test(entry.spine)) {
    throw new Error(`site.json: "${entry.title}" has spine "${entry.spine}", expected #rrggbb`);
  }
  const pages = entry.pages ?? data?.pages ?? null;
  const aspect = data?.coverPx ? data.coverPx.width / data.coverPx.height : DEFAULT_ASPECT;
  // Real height when we know it; otherwise height follows the cover's shape
  // at a standard width. Either way the cover image is never stretched.
  const knownHeight = entry.heightMm ?? data?.heightMm ?? null;
  const heightMm = knownHeight ?? DEFAULT_WIDTH_MM / aspect;
  const widthMm = heightMm * aspect;
  const thicknessMm = pages ? pages * MM_PER_PAGE + COVERS_MM : DEFAULT_THICKNESS_MM;
  return { ...entry, slug: slug(entry.title), cover: data?.cover ?? null, pages, widthMm, heightMm, thicknessMm, readLabel: readLabel(entry) };
}

// JSON imports type null fields as literally null, so both need widening.
const data = site as Site;
const byslug = fetched as Record<string, FetchedBook>;

export const SITE = {
  ...data,
  shelf: {
    ...data.shelf,
    books: data.shelf.books.map((b) => measure(b, byslug[slug(b.title)])),
  },
};
