import { ImageResponse } from "next/og";
import { brygada, INK, PAPER } from "./brand";

// Browser-tab icon: a lowercase "dm" in Brygada on the page's cream.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
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
          fontSize: 40,
          letterSpacing: "-0.03em",
          // Optical centring: the x-height sits low in the em box.
          paddingBottom: 6,
        }}
      >
        dm
      </div>
    ),
    { ...size, fonts: [{ name: "Brygada", data: await brygada(), style: "normal", weight: 400 }] },
  );
}
