import {
  Brygada_1918,
  Reenie_Beanie,
  Shrikhand,
  Sofia_Sans_Extra_Condensed,
  Spline_Sans_Mono,
} from "next/font/google";

// The *-face variables feed the role tokens in styles/tokens.css.

export const display = Shrikhand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-face",
});

export const heading = Sofia_Sans_Extra_Condensed({
  subsets: ["latin"],
  variable: "--font-heading-face",
});

export const body = Brygada_1918({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-body-face",
});

export const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
});

export const hand = Reenie_Beanie({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hand-face",
});

export const fontVariables = [display, heading, body, mono, hand].map((f) => f.variable).join(" ");
