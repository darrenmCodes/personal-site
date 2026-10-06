#!/usr/bin/env node
// Fetches a cover image, page count and physical size for every book in
// content/site.json, saves covers to public/covers/ and the numbers to
// content/books.json. Run by hand when the shelf changes: pnpm books
//
// Talks to Open Library and Google Books (both US-hosted). Only titles,
// authors and ISBNs are sent. Visitors' browsers never contact either.
//
// Per-book overrides in site.json: "isbn" picks an exact edition, "coverId"
// picks one of Open Library's cover scans when the edition's first one is
// poor, and "pages" and "heightMm" beat whatever the APIs say.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = path.join(ROOT, "content/site.json");
const OUT = path.join(ROOT, "content/books.json");
const COVERS = path.join(ROOT, "public/covers");
const UA = "darren-maher-personal-site/1.0 (local bookshelf script)";
// The tallest book on the shelf is 220px, so covers are saved twice that
// for retina screens. The 3D shelf's cover textures are never drawn larger.
const COVER_HEIGHT = 440;

export const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function getBytes(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

const TO_MM = { inches: 25.4, inch: 25.4, in: 25.4, centimeters: 10, centimetres: 10, cm: 10, millimeters: 1, mm: 1 };

/** "7.8 x 5.1 x 1 inches" or "20.30 cm": height first, by Open Library convention. */
function parseLength(text) {
  const m = /([\d.]+)\s*([a-z]+)/i.exec(text ?? "");
  const unit = m && TO_MM[m[2].toLowerCase()];
  return unit ? Number(m[1]) * unit : null;
}

function parseOpenLibraryDims(text) {
  if (!text) return null;
  const unitMatch = /(inches|inch|in|centimeters|centimetres|cm|millimeters|mm)\b/i.exec(text);
  const nums = [...text.matchAll(/[\d.]+/g)].map((m) => Number(m[0]));
  if (!unitMatch || nums.length < 2) return null;
  const k = TO_MM[unitMatch[1].toLowerCase()];
  return { heightMm: nums[0] * k, widthMm: nums[1] * k };
}

// Physical sizes in these databases are sometimes nonsense (a 1 cm tall
// novel); only believe ones that look like a real book.
const plausibleHeight = (mm) => mm != null && mm >= 140 && mm <= 300;

async function fromOpenLibrary(book) {
  let edition = null;
  let work = null;
  if (book.isbn) {
    edition = await getJson(`https://openlibrary.org/isbn/${book.isbn}.json`);
  } else {
    const q = new URLSearchParams({
      title: book.title,
      author: book.author ?? "",
      fields: "key,title,author_name,cover_i,cover_edition_key,number_of_pages_median",
      limit: "5",
    });
    const search = await getJson(`https://openlibrary.org/search.json?${q}`);
    work = search.docs.find((d) => d.cover_edition_key || d.cover_i) ?? search.docs[0] ?? null;
    if (work?.cover_edition_key) {
      edition = await getJson(`https://openlibrary.org/books/${work.cover_edition_key}.json`);
    }
  }
  const coverId = book.coverId ?? edition?.covers?.find((c) => c > 0) ?? work?.cover_i ?? null;
  return {
    pages: edition?.number_of_pages ?? work?.number_of_pages_median ?? null,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false` : null,
    dims: parseOpenLibraryDims(edition?.physical_dimensions),
    source: edition?.key ? `https://openlibrary.org${edition.key}` : work?.key ? `https://openlibrary.org${work.key}` : null,
  };
}

async function fromGoogleBooks(book) {
  const terms = book.isbn
    ? `isbn:${book.isbn}`
    : `intitle:"${book.title}"${book.author ? ` inauthor:"${book.author}"` : ""}`;
  const q = new URLSearchParams({ q: terms, printType: "books", maxResults: "8" });
  const list = await getJson(`https://www.googleapis.com/books/v1/volumes?${q}`);
  const pick = (list.items ?? []).find((v) => v.volumeInfo?.pageCount) ?? list.items?.[0];
  if (!pick) return { pages: null, dims: null, coverUrl: null, source: null };
  const detail = await getJson(`https://www.googleapis.com/books/v1/volumes/${pick.id}`);
  const info = detail.volumeInfo ?? {};
  const heightMm = parseLength(info.dimensions?.height);
  const widthMm = parseLength(info.dimensions?.width);
  const img = info.imageLinks?.large ?? info.imageLinks?.medium ?? info.imageLinks?.thumbnail ?? null;
  return {
    pages: info.pageCount ?? null,
    dims: heightMm ? { heightMm, widthMm } : null,
    coverUrl: img ? img.replace(/^http:/, "https:") : null,
    source: `https://books.google.com/books?id=${pick.id}`,
  };
}

async function settle(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`  ${label} failed: ${err.message}`);
    return { pages: null, dims: null, coverUrl: null, source: null };
  }
}

async function main() {
  const site = JSON.parse(await readFile(SITE, "utf8"));
  const books = site.shelf.books;
  await mkdir(COVERS, { recursive: true });
  const out = {};

  for (const book of books) {
    const key = slug(book.title);
    console.log(`${book.title}${book.author ? `, ${book.author}` : ""}`);
    const ol = await settle("Open Library", () => fromOpenLibrary(book));
    const gb = await settle("Google Books", () => fromGoogleBooks(book));

    let cover = null;
    let coverPx = null;
    for (const url of [ol.coverUrl, gb.coverUrl].filter(Boolean)) {
      try {
        const bytes = await getBytes(url);
        const size = jpegSize(bytes);
        if (!size) throw new Error("not a JPEG");
        await sharp(bytes)
          .resize({ height: COVER_HEIGHT, withoutEnlargement: true })
          .webp({ quality: 80, effort: 6 })
          .toFile(path.join(COVERS, `${key}.webp`));
        cover = `/covers/${key}.webp`;
        // The source size, not the resized one: content/index.ts takes the
        // cover's aspect ratio from this, and resizing rounds it slightly.
        coverPx = size;
        console.log(`  cover ${size.width}x${size.height} from ${new URL(url).host}`);
        break;
      } catch (err) {
        console.warn(`  cover ${url} failed: ${err.message}`);
      }
    }

    const dims = [ol.dims, gb.dims].find((d) => d && plausibleHeight(d.heightMm)) ?? null;
    const pages = book.pages ?? ol.pages ?? gb.pages ?? null;
    out[key] = {
      pages,
      heightMm: book.heightMm ?? (dims ? Math.round(dims.heightMm) : null),
      cover,
      coverPx,
      sources: [ol.source, gb.source].filter(Boolean),
      fetched: new Date().toISOString().slice(0, 10),
    };
    console.log(`  pages ${pages ?? "unknown"}, height ${out[key].heightMm ?? "unknown"} mm`);
  }

  await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
