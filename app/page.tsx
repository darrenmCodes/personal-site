import { Fragment, type ReactNode } from "react";
import { Age } from "@/components/Age";
import { Bookshelf } from "@/components/bookshelf/Bookshelf";
import { EmailLink } from "@/components/EmailLink";
import { PrintNotes } from "@/components/PrintNotes";
import { Quote } from "@/components/Quote";
import { SITE } from "@/content";
import styles from "./page.module.css";

// Two text styles only: serif ink for everything Darren says, smaller grey
// serif for labels and notes. Every section is a label followed by plain lines.
// Anything not filled in yet in site.json simply isn't shown.

function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.label}>
        {label}
      </h2>
      {children}
    </section>
  );
}

// Every link on the site opens in a new tab. Screen readers are told so.
function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

// Turns the first mention of each linked word (bioLinks, colophonLinks) into a link.
function withLinks(text: string, links: Record<string, string>): ReactNode[] {
  const words = Object.keys(links).filter((w) => text.includes(w));
  if (words.length === 0) return [text];
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
  const used = new Set<string>();
  return text.split(pattern).map((part, i) => {
    if (!(part in links) || used.has(part)) return part;
    used.add(part);
    return (
      <Link key={i} href={links[part]}>
        {part}
      </Link>
    );
  });
}

const NOW_ROWS = [
  ["working", "working on"],
  ["reading", "reading"],
  ["listening", "listening to"],
] as const;

export default function Home() {
  const { name, origin, born, bio, bioLinks, now, made, shelf, elsewhere, email, contact, colophon, colophonLinks } = SITE;
  const nowRows = NOW_ROWS.filter(([key]) => now[key]);
  const projects = made.filter((p) => p.name);
  // Footnotes, numbered in the order they appear.
  const notes = projects.filter((p) => p.note);
  const noteNumber = (p: (typeof projects)[number]) => notes.indexOf(p) + 1;
  const links = elsewhere.filter((l) => l.href);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.name}>{name}</h1>
        <p>{origin}</p>
      </header>

      <Section id="about" label="about">
        <div className={`${styles.lines} ${styles.bio}`}>
          {bio.map((line) => (
            <p key={line}>
              {line.split("{age}").map((part, i) => (
                <Fragment key={i}>
                  {i > 0 ? <Age born={born} /> : null}
                  {withLinks(part, bioLinks)}
                </Fragment>
              ))}
            </p>
          ))}
        </div>
      </Section>

      {nowRows.length > 0 ? (
        <Section id="now" label="now">
          <div className={styles.lines}>
            {nowRows.map(([key, label]) => (
              <p key={key}>
                {label} {now[key]}
              </p>
            ))}
          </div>
          {now.updated ? (
            <p className={styles.note}>
              last updated <time dateTime={now.updated}>{now.updated}</time>
            </p>
          ) : null}
        </Section>
      ) : null}

      <Section id="so-far" label="so far">
        <div className={styles.entries}>
          {projects.map((p) => (
            <p key={p.name}>
              <span className={styles.entryName}>
                {p.href ? <Link href={p.href}>{p.name}</Link> : p.name}
                {p.note ? (
                  <a className={styles.noteRef} href={`#note-${noteNumber(p)}`} id={`note-ref-${noteNumber(p)}`} aria-label={`note ${noteNumber(p)}`}>
                    {noteNumber(p)}
                  </a>
                ) : null}
              </span>{" "}
              <span className={styles.entryText}>{p.description}</span>
            </p>
          ))}
        </div>
      </Section>

      <Section id="shelf" label="bookshelf">
        <Bookshelf books={shelf.books} />
      </Section>

      <Section id="elsewhere" label="elsewhere">
        <div className={styles.lines}>
          <p>{contact}</p>
          {email ? (
            <p>
              <EmailLink address={email} />
            </p>
          ) : null}
        </div>
        <ul className={styles.links}>
          {links.map((l) => (
            <li key={l.label}>
              {l.href ? <Link href={l.href}>{l.label}</Link> : l.label}
            </li>
          ))}
        </ul>
      </Section>

      <footer className={styles.footer}>
        {notes.length > 0 ? (
          <ol className={styles.notes}>
            {notes.map((p, i) => (
              <li key={p.name} id={`note-${i + 1}`}>
                <a className={styles.noteBack} href={`#note-ref-${i + 1}`} aria-label={`back to ${p.name}`}>
                  {i + 1}
                </a>{" "}
                {p.note}
              </li>
            ))}
          </ol>
        ) : null}
        <hr className={styles.rule} />
        <Quote />
        <p className={styles.note}>{withLinks(colophon, colophonLinks)}</p>
      </footer>

      <PrintNotes />
    </main>
  );
}
