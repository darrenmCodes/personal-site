import { ImageResponse } from "next/og";
import { brygada, INK, PAPER } from "./brand";

// Home-screen icon on iPhone and iPad. Same "dm" as the favicon, more room.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          color: INK,
          fontFamily: "Brygada",
          fontSize: 96,
          letterSpacing: "-0.03em",
          paddingBottom: 14,
        }}
      >
        dm
      </div>
    ),
    { ...size, fonts: [{ name: "Brygada", data: await brygada(), style: "normal", weight: 400 }] },
  );
}
