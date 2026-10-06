"use client";

import { useId } from "react";
import { playSwitchClick } from "@/lib/audio/engine";
import { FILM_LOOKS, type FilmLook } from "@/lib/projector/constants";
import { projectorStore, useProjector } from "@/lib/projector/store";
import styles from "./ProjectorPanel.module.css";

const LOOK_LABELS: Record<FilmLook, string> = {
  sunny: "Sunny",
  faded: "Faded",
  lateNight: "Late night",
};

const KNOB_ANGLE: Record<FilmLook, number> = {
  sunny: -50,
  faded: 0,
  lateNight: 50,
};

function clickIfSoundOn(pitch?: number) {
  if (projectorStore.get().sound) playSwitchClick(pitch);
}

interface LeverProps {
  label: string;
  on: boolean;
  onText: string;
  offText: string;
  disabled?: boolean;
  onToggle: () => void;
}

function Lever({ label, on, onText, offText, disabled, onToggle }: LeverProps) {
  const labelId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelId}
      disabled={disabled}
      className={styles.lever}
      data-on={on}
      onClick={onToggle}
    >
      <span id={labelId} className={styles.leverLabel}>
        {label}
      </span>
      <span className={styles.leverBody} aria-hidden="true">
        <span className={styles.leverState} data-active={on}>
          {onText}
        </span>
        <span className={styles.leverSlot}>
          <span className={styles.leverBat} />
        </span>
        <span className={styles.leverState} data-active={!on}>
          {offText}
        </span>
      </span>
    </button>
  );
}

function Screw({ angle, className }: { angle: number; className: string }) {
  return (
    <svg className={`${styles.screw} ${className}`} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4.2" />
      <line x1="1.6" y1="5" x2="8.4" y2="5" transform={`rotate(${angle} 5 5)`} />
    </svg>
  );
}

function ReelIcon() {
  return (
    <svg className={styles.reelIcon} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="6.2" r="2.4" />
      <circle cx="17" cy="14.9" r="2.4" />
      <circle cx="7" cy="14.9" r="2.4" />
    </svg>
  );
}

export function ProjectorPanel() {
  const s = useProjector();
  const groupName = useId();

  const cycleLook = () => {
    const i = FILM_LOOKS.indexOf(s.look);
    projectorStore.setLook(FILM_LOOKS[(i + 1) % FILM_LOOKS.length]);
    clickIfSoundOn(0.8);
  };

  return (
    <section className={styles.projector} data-open={s.panelOpen} aria-label="Projector controls">
      <div id="projector-plate" className={styles.plate} hidden={!s.panelOpen}>
        <Screw angle={20} className={styles.screwTL} />
        <Screw angle={-35} className={styles.screwTR} />
        <Screw angle={80} className={styles.screwBL} />
        <Screw angle={5} className={styles.screwBR} />

        <p className={styles.badge} aria-hidden="true">
          <span>DM-18</span>
          <span>18 fps</span>
          <span>Carlow</span>
        </p>

        <div className={styles.controls}>
          <Lever
            label="Motion"
            on={!s.paused && !s.reducedMotion}
            onText="Run"
            offText="Hold"
            disabled={s.reducedMotion}
            onToggle={() => {
              projectorStore.togglePaused();
              clickIfSoundOn();
            }}
          />
          <Lever
            label="Sound"
            on={s.sound}
            onText="On"
            offText="Off"
            onToggle={() => {
              projectorStore.toggleSound();
              clickIfSoundOn(1.15);
            }}
          />

          <fieldset className={styles.stock}>
          <legend className={styles.stockLegend}>Film stock</legend>
          <button
            type="button"
            className={styles.knob}
            onClick={cycleLook}
            aria-label={`Turn to the next film stock. Now: ${LOOK_LABELS[s.look]}`}
          >
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle className={styles.knobKnurl} cx="20" cy="20" r="18" />
              <circle className={styles.knobFace} cx="20" cy="20" r="13" />
              <g className={styles.knobPointer} style={{ transform: `rotate(${KNOB_ANGLE[s.look]}deg)` }}>
                <line x1="20" y1="20" x2="20" y2="9" />
              </g>
            </svg>
          </button>
          <div className={styles.stockOptions}>
            {FILM_LOOKS.map((look) => (
              <label key={look} className={styles.stockOption}>
                <input
                  type="radio"
                  name={groupName}
                  value={look}
                  checked={s.look === look}
                  onChange={() => {
                    projectorStore.setLook(look);
                    clickIfSoundOn(0.8);
                  }}
                />
                <span>{LOOK_LABELS[look]}</span>
              </label>
            ))}
          </div>
          </fieldset>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={s.commentary}
          className={styles.lampButton}
          onClick={() => {
            projectorStore.toggleCommentary();
            clickIfSoundOn(1.3);
          }}
        >
          <span className={styles.lamp} data-lit={s.commentary} aria-hidden="true" />
          Commentary
        </button>

        <p className={styles.scribble}>
          {s.reducedMotion
            ? "Held still. Your device asked for less motion."
            : "Sound stays off till you say so."}
        </p>
      </div>

      <button
        type="button"
        className={styles.tab}
        aria-expanded={s.panelOpen}
        aria-controls="projector-plate"
        onClick={() => {
          projectorStore.setPanelOpen(!s.panelOpen);
          clickIfSoundOn(0.9);
        }}
      >
        <ReelIcon />
        <span>Projector</span>
        <span className={styles.tabHint} aria-hidden="true">
          {s.panelOpen ? "fold" : "open"}
        </span>
      </button>
    </section>
  );
}
