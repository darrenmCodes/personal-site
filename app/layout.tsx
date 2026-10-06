import type { Metadata, Viewport } from "next";
import { FilmOverlay } from "@/components/film/FilmOverlay";
import { REEL_ID } from "@/components/film/reel";
import { ProjectorPanel } from "@/components/projector/ProjectorPanel";
import { PROJECTOR_BOOT_SCRIPT } from "@/lib/projector/boot";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Darren Maher",
  description: "From Carlow. Living in Dublin. Loud. Funny. GMI.",
};

export const viewport: Viewport = {
  themeColor: "#f5ecd7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets data-look/motion/commentary before hydration.
    <html lang="en-IE" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PROJECTOR_BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to the good bit
        </a>
        <div id={REEL_ID} className="reel">
          {children}
        </div>
        <FilmOverlay />
        <ProjectorPanel />
      </body>
    </html>
  );
}
