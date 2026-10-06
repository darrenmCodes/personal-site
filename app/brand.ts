import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared by the generated share card and icons, which render outside the page
// and so can't read CSS variables. Keep in step with :root in globals.css.
export const PAPER = "#f4ecdc";
export const INK = "#2b231d";
export const INK_MUTED = "#6b5d50";

// The image renderer (Satori) crashes on the page's variable Brygada, so it
// gets a static Regular cut from that same file with fontTools:
// instantiateVariableFont(wght=400), minus the GSUB/GPOS/GDEF/STAT tables.
export const brygada = () => readFile(join(process.cwd(), "app/fonts/Brygada1918-Regular-static.ttf"));
