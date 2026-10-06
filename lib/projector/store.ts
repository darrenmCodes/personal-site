import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  isFilmLook,
  PROJECTOR_STORAGE_KEY,
  type FilmLook,
  type ProjectorSettings,
} from "./constants";

export interface ProjectorState extends ProjectorSettings {
  // Sound is deliberately not persisted: every visit starts silent.
  sound: boolean;
  reducedMotion: boolean;
}

const SERVER_STATE: ProjectorState = {
  ...DEFAULT_SETTINGS,
  sound: false,
  reducedMotion: false,
};

let state: ProjectorState = SERVER_STATE;
let initialised = false;
const listeners = new Set<() => void>();

function readStored(): Partial<ProjectorSettings> {
  try {
    const raw = window.localStorage.getItem(PROJECTOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const p = parsed as Record<string, unknown>;
    const out: Partial<ProjectorSettings> = {};
    if (typeof p.paused === "boolean") out.paused = p.paused;
    if (isFilmLook(p.look)) out.look = p.look;
    if (typeof p.commentary === "boolean") out.commentary = p.commentary;
    if (typeof p.panelOpen === "boolean") out.panelOpen = p.panelOpen;
    return out;
  } catch (err) {
    console.warn("projector: saved settings unreadable, using defaults", err);
    return {};
  }
}

function persist(s: ProjectorState) {
  const settings: ProjectorSettings = {
    paused: s.paused,
    look: s.look,
    commentary: s.commentary,
    panelOpen: s.panelOpen,
  };
  try {
    window.localStorage.setItem(PROJECTOR_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    // Private mode or storage full. Settings still work for this visit.
    console.warn("projector: could not save settings", err);
  }
}

function applyToDocument(s: ProjectorState) {
  const d = document.documentElement.dataset;
  d.look = s.look;
  d.motion = motionAllowed(s) ? "on" : "off";
  d.commentary = s.commentary ? "on" : "off";
}

function init() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  // On a phone the open panel would cover the page, so first visits start folded.
  const narrow = window.matchMedia("(max-width: 640px)").matches;
  state = {
    ...SERVER_STATE,
    panelOpen: !narrow,
    ...readStored(),
    reducedMotion: mq.matches,
  };
  applyToDocument(state);
  mq.addEventListener("change", (e) => update({ reducedMotion: e.matches }));
}

function update(patch: Partial<ProjectorState>) {
  init();
  state = { ...state, ...patch };
  applyToDocument(state);
  persist(state);
  listeners.forEach((l) => l());
}

export function motionAllowed(s: ProjectorState): boolean {
  return !s.paused && !s.reducedMotion;
}

export const projectorStore = {
  get(): ProjectorState {
    init();
    return state;
  },
  subscribe(listener: () => void): () => void {
    init();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  togglePaused: () => update({ paused: !state.paused }),
  toggleSound: () => update({ sound: !state.sound }),
  toggleCommentary: () => update({ commentary: !state.commentary }),
  setLook: (look: FilmLook) => update({ look }),
  setPanelOpen: (panelOpen: boolean) => update({ panelOpen }),
};

const getServerSnapshot = () => SERVER_STATE;

export function useProjector(): ProjectorState {
  return useSyncExternalStore(projectorStore.subscribe, projectorStore.get, getServerSnapshot);
}
