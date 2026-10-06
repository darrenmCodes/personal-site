import type { Metadata } from "next";
import { MarginNote } from "@/components/commentary/MarginNote";
import { MediaSlot } from "@/components/media/MediaSlot";
import { ContrastLab } from "./ContrastLab";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Test reel · Darren Maher",
  robots: { index: false },
};

const STOCK = [
  { token: "--c-cream", name: "Cream", note: "the base" },
  { token: "--c-sky", name: "Sky", note: "faded blue" },
  { token: "--c-grass", name: "Grass", note: "a back garden" },
  { token: "--c-coral", name: "Coral", note: "sunburn" },
  { token: "--c-peach", name: "Peach", note: "soft" },
  { token: "--c-ink", name: "Ink", note: "words" },
];

const TYPE_CAST = [
  {
    job: "Big moments only",
    face: "Shrikhand",
    sample: "Darren Maher",
    className: styles.sampleDisplay,
  },
  {
    job: "Headings",
    face: "Sofia Sans Extra Condensed",
    sample: "Things I've made, mostly on a couch",
    className: styles.sampleHeading,
  },
  {
    job: "Reading",
    face: "Brygada 1918",
    sample:
      "Dropped out of college after first year to build a startup. The college has been informed. Now I think startups are the best vehicle going for making the world a bit better, and I'm not quiet about it.",
    className: styles.sampleBody,
  },
  {
    job: "Labels and slates",
    face: "Spline Sans Mono",
    sample: "Roll 01 · 18 fps · Carlow to Dublin · Take 3",
    className: styles.sampleMono,
  },
  {
    job: "Margin notes",
    face: "Reenie Beanie",
    sample: "this is the margin. I talk here.",
    className: styles.sampleHand,
  },
];

const ACCENTS = [
  { token: "--c-black", name: "Black" },
  { token: "--c-red", name: "Red" },
  { token: "--c-yellow", name: "Yellow" },
];

export default function TestReel() {
  return (
    <main id="main" className={styles.page}>
      <header className={styles.opening}>
        <dl className={styles.slate}>
          <div>
            <dt>Prod.</dt>
            <dd>Darren Maher</dd>
          </div>
          <div>
            <dt>Roll</dt>
            <dd>01</dd>
          </div>
          <div>
            <dt>Scene</dt>
            <dd>Test reel</dd>
          </div>
          <div>
            <dt>Take</dt>
            <dd>3</dd>
          </div>
        </dl>
        <h1 className={styles.title}>
          Colour
          <br />
          check.
        </h1>
        <p className={styles.lede}>
          This isn&apos;t the website. This is the bit where we make sure the colours behave before
          anyone important sees them. Flip the switches on the projector, bottom left.
        </p>
        <MarginNote className={styles.noteTake} tilt={4}>
          takes 1 and 2 were somehow worse
        </MarginNote>
      </header>

      <section className={styles.stockSection} aria-labelledby="stock-heading">
        <h2 id="stock-heading" className={styles.sectionLabel}>
          <span>Stock</span> The colours
        </h2>
        <ul className={styles.chart}>
          {STOCK.map((c, i) => (
            <li
              key={c.token}
              className={styles.chip}
              style={{ background: `var(${c.token})`, rotate: `${[-2, 1.5, -1, 2.5, -1.5, 1][i]}deg` }}
            >
              <span className={styles.chipName}>{c.name}</span>
              <span className={styles.chipNote}>{c.note}</span>
            </li>
          ))}
        </ul>
        <div className={styles.accents}>
          <p className={styles.accentsLabel}>Small doses only</p>
          <ul>
            {ACCENTS.map((c) => (
              <li key={c.token}>
                <span className={styles.dot} style={{ background: `var(${c.token})` }} />
                {c.name}
              </li>
            ))}
          </ul>
        </div>
        <MarginNote className={styles.noteStock} tilt={-5}>
          no purple. not one drop.
        </MarginNote>
      </section>

      <section className={styles.typeSection} aria-labelledby="type-heading">
        <h2 id="type-heading" className={styles.sectionLabel}>
          <span>Type</span> The cast
        </h2>
        <p className={styles.aside}>
          Five faces, one job each. The big poster one only comes out for the moments that earn it.
        </p>
        <div className={styles.specimen}>
          {TYPE_CAST.map((t) => (
            <div key={t.job} className={styles.specimenRow}>
              <div className={styles.specimenMeta}>
                <p className={styles.specimenRole}>{t.job}</p>
                <p className={styles.specimenFace}>{t.face}</p>
              </div>
              <p className={t.className}>{t.sample}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.photoSection} aria-labelledby="photo-heading">
        <MediaSlot
          className={styles.photo}
          label="PHOTO OF DARREN HERE"
          hint="Sunny, a bit blurry, ideally squinting. Any phone photo works."
        />
        <div className={styles.photoCopy}>
          <h2 id="photo-heading" className={styles.sectionLabel}>
            <span>Treatment</span> Photos of me
          </h2>
          <p>
            Every image slot is a labelled placeholder until I swap in the real thing. Soft focus, a
            bit of motion blur, and the sun bleeding orange into the frame like old film does.
          </p>
          <p className={styles.small}>
            Halation, the orange bleed, only shows on bright bits. Switch to Late night and the
            headings pick it up too.
          </p>
        </div>
        <MarginNote className={styles.notePhoto} tilt={-2}>
          my good side is the blurry one
        </MarginNote>
      </section>

      <section className={styles.contrastSection} aria-labelledby="contrast-heading">
        <h2 id="contrast-heading" className={styles.sectionLabel}>
          <span>Lab</span> Can you read it
        </h2>
        <p className={styles.aside}>
          Live contrast check for whichever film stock is loaded. Normal text needs 4.5 to 1, big
          text needs 3. Grain and light leaks are budgeted so they never drag text under that.
        </p>
        <ContrastLab />
      </section>

      <footer className={styles.tail}>
        <p>End of roll 01.</p>
        <p className={styles.tailNext}>Next reel: the lift.</p>
      </footer>
    </main>
  );
}
