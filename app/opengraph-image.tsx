import { ImageResponse } from "next/og";
import { brygada, INK, INK_MUTED, PAPER } from "./brand";

// The card shown when the link is shared on X, LinkedIn, iMessage and so on.
// Generated once at build time, laid out like the top of the page.

export const alt = "Darren Maher. From Carlow, living in Dublin.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 120px",
          background: PAPER,
          fontFamily: "Brygada",
        }}
      >
        <div style={{ fontSize: 112, color: INK, lineHeight: 1.05, letterSpacing: "-0.012em" }}>Darren Maher</div>
        <div style={{ marginTop: 28, fontSize: 40, color: INK_MUTED }}>from carlow. living in dublin.</div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Brygada", data: await brygada(), style: "normal", weight: 400 }],
    },
  );
}
