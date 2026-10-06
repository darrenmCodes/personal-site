import styles from "./MediaSlot.module.css";

interface MediaSlotProps {
  /** What goes here, shouted. e.g. "PHOTO OF DARREN HERE". */
  label: string;
  /** Plain note for Darren about what to put in the slot. */
  hint?: string;
  ratio?: `${number} / ${number}`;
  className?: string;
}

// A clearly labelled empty slot. The painted scene is flat CSS shapes so the
// placeholder can't be mistaken for a real photo. The same grain, blur and
// halation treatment will wrap Darren's real photos when they arrive.
export function MediaSlot({ label, hint, ratio = "4 / 5", className }: MediaSlotProps) {
  return (
    <figure className={`${styles.slot} ${className ?? ""}`} style={{ aspectRatio: ratio }}>
      <div className={styles.scene} aria-hidden="true">
        <span className={styles.sun} />
        <span className={styles.hill} />
        <span className={styles.hillBack} />
      </div>
      <figcaption className={styles.label}>
        <strong>{label}</strong>
        {hint ? <span>{hint}</span> : null}
      </figcaption>
    </figure>
  );
}
