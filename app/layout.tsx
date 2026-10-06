import type { Metadata, Viewport } from "next";
import { brygada } from "./fonts";
import "./globals.css";

const description = "from carlow. living in dublin.";

export const metadata: Metadata = {
  // Share cards need absolute image URLs. There's no domain yet (the site is
  // local only), so set SITE_URL once it has one.
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "darren maher",
  description,
  openGraph: {
    type: "website",
    title: "darren maher",
    description,
    siteName: "darren maher",
    locale: "en_IE",
  },
  twitter: {
    card: "summary_large_image",
    title: "darren maher",
    description,
    creator: "@darrenmaher06",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4ecdc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IE" className={brygada.variable}>
      <body>{children}</body>
    </html>
  );
}
