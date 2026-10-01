"use client";

import { initialsOf } from "@/components/avatar/PersonAvatar";
import { TILE_CLASS_NAME } from "./classNames";

/** Calm fills with white text (>= 4.5:1); never brand crimson, so a workspace does not look like an alert. */
const PALETTE = ["#1D4ED8", "#0F766E", "#7C3AED", "#B45309", "#BE185D", "#0369A1", "#4D7C0F", "#9333EA", "#C2410C", "#334155"];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

/** A rounded tile with the workspace's two initials; the colour comes from its name, so it is the same everywhere. */
export const WorkspaceTile = ({ name, size = 56 }: { readonly name: string; readonly size?: number }) => (
  <span className={TILE_CLASS_NAME} style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: PALETTE[hash(name) % PALETTE.length] }} role="img" aria-label={name}>
    {initialsOf(name).slice(0, 2)}
  </span>
);
