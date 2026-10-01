"use client";

import { useState } from "react";

/**
 * Google-style avatar: the photo when there is one, otherwise the person's initials on a colour
 * chosen deterministically from their name (same name → same colour on every screen).
 */
export type PersonAvatarProps = {
  readonly name: string;
  readonly src?: string | null;
  readonly size?: "xs" | "sm" | "md" | "lg";
  /** Small green dot for "online / active". */
  readonly online?: boolean;
};

const SIZES = { xs: 24, sm: 32, md: 40, lg: 56 } as const;

/** Calm, accessible fills (white text ≥ 4.5:1) — no brand crimson, so people never look like alerts. */
const PALETTE = ["#1D4ED8", "#0F766E", "#7C3AED", "#B45309", "#BE185D", "#0369A1", "#4D7C0F", "#9333EA", "#C2410C", "#334155"];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

/** "An Nguyen" → "AN", "Khách hàng A" → "KA", "demo" → "D". */
export const initialsOf = (name: string) => {
  // Only words that start with a letter count: "Anh Hùng (Facebook)" → "AH", not "A(".
  const words = name.replace(/\([^)]*\)/g, " ").trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] ?? "" : "";
  return (first + last).toLocaleUpperCase("vi");
};

export const PersonAvatar = ({ name, src, size = "md", online }: PersonAvatarProps) => {
  const [broken, setBroken] = useState(false);
  const px = SIZES[size];
  const showPhoto = Boolean(src) && !broken;
  return (
    <span
      className="nivo-avatar"
      style={{ width: px, height: px, fontSize: Math.round(px * 0.4), background: showPhoto ? "#E2E8F0" : PALETTE[hash(name) % PALETTE.length] }}
      role="img"
      aria-label={name}
      title={name}
    >
      {showPhoto ? (
        <img src={src ?? undefined} alt="" onError={() => setBroken(true)} referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
      {online ? <span className="nivo-avatar-dot" aria-hidden="true" /> : null}
    </span>
  );
};

/** AI agents are rounded squares with their module glyph, so a person and an agent are never confused. */
export type AgentAvatarProps = { readonly module?: string; readonly size?: "xs" | "sm" | "md" | "lg"; readonly online?: boolean; readonly label?: string };

const GLYPH: Record<string, string> = {
  chatbot: "M4 5h16v10H9l-5 4z",
  sales: "M4 17l5-5 4 4 7-8M15 8h5v5",
  accounting: "M6 3h9l3 3v15H6zM9 12h6M9 16h6M9 8h3",
};

export const AgentAvatar = ({ module = "chatbot", size = "md", online, label }: AgentAvatarProps) => {
  const px = SIZES[size];
  return (
    <span className="nivo-agent-avatar" style={{ width: px, height: px }} role="img" aria-label={label ?? `AI agent · ${module}`} title={label}>
      <svg viewBox="0 0 24 24" width={Math.round(px * 0.55)} height={Math.round(px * 0.55)} aria-hidden="true">
        <path d={GLYPH[module] ?? GLYPH.chatbot} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {online ? <span className="nivo-avatar-dot" aria-hidden="true" /> : null}
    </span>
  );
};
