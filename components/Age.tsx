"use client";

// Worked out in the visitor's browser so it never goes stale, even if the
// page was built months ago. Only the birth month is known, so the new age
// starts the month after it rather than risk claiming it early.
export function Age({ born }: { born: string }) {
  const [year, month] = born.split("-").map(Number);
  const now = new Date();
  const age = now.getFullYear() - year - (now.getMonth() + 1 <= month ? 1 : 0);
  // The built HTML holds the age as of the build; the browser may disagree.
  return <span suppressHydrationWarning>{age}</span>;
}
