import localFont from "next/font/local";

// Self-hosted rather than next/font/google: Google's copy of Brygada strips
// the old-style numerals (onum) and small caps the font ships with. This is
// the upstream variable font (google/fonts, OFL, licence in ./fonts/OFL.txt)
// cut down to Latin, Latin-1 (Irish fadas, €) and punctuation, with every
// OpenType feature kept. No italic: the page never sets any.
export const brygada = localFont({
  src: "./fonts/Brygada1918-subset.woff",
  weight: "400 700",
  style: "normal",
  variable: "--font-serif",
  adjustFontFallback: "Times New Roman",
});
