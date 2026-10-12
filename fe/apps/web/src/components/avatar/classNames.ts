/**
 * App-owned layout of the avatar marks. Grammar owns the plate (`Avatar`, `IconTile`): size, corner, fill, initials.
 * grammar gap: neither `Avatar` nor `IconTile` publishes a presence ("online") indicator, so the app keeps the
 * smallest wrapper and dot, painted with semantic tokens only (RADIUS-9 case-1 for the dot; `--success` is the
 * settled-state token, `--surface` the ring that separates it from the plate).
 */

/** Positions the presence dot on the mark's corner. */
export const MARK = "relative inline-flex shrink-0";
/** Presence dot: a real "active" state, so the success token (ACCENT-5); ring on the surface face. */
export const PRESENCE_DOT = "absolute -bottom-px -right-px size-2.5 rounded-full bg-success ring-2 ring-surface";
