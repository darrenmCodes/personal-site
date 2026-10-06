export const FILM_LOOKS = ["sunny", "faded", "lateNight"] as const;
export type FilmLook = (typeof FILM_LOOKS)[number];

export const PROJECTOR_STORAGE_KEY = "dm:projector:v1";

export interface ProjectorSettings {
  paused: boolean;
  look: FilmLook;
  commentary: boolean;
  panelOpen: boolean;
}

export const DEFAULT_SETTINGS: ProjectorSettings = {
  paused: false,
  look: "sunny",
  commentary: false,
  panelOpen: true,
};

export function isFilmLook(value: unknown): value is FilmLook {
  return typeof value === "string" && (FILM_LOOKS as readonly string[]).includes(value);
}
