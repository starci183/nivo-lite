import type { CSSProperties } from "react";

/**
 * NIVO logo from the Brand System V1.1 approved raster references (page 9):
 * "full" = NIVO primary color, "os" = NIVO OS product lockup, "mark" = Standard O mark.
 * APPROVED REFERENCE — PRODUCTION ASSET PENDING: replace with the master SVGs
 * (NIVO_LOGO_PRIMARY_COLOR_RGB_V1.1.svg …) when they exist. Light surfaces only; never invert.
 */
export type NivoLogoProps = { readonly variant?: "full" | "os" | "mark"; readonly height?: number };

const SOURCES = {
  full: { src: "/brand/nivo-logo.png", ratio: 322 / 114, alt: "NIVO" },
  os: { src: "/brand/nivo-os.png", ratio: 284 / 90, alt: "NIVO OS" },
  mark: { src: "/brand/nivo-mark.png", ratio: 154 / 156, alt: "NIVO" },
} as const;

export const NivoLogo = ({ variant = "os", height = 28 }: NivoLogoProps) => {
  const s = SOURCES[variant];
  const style: CSSProperties = { height, width: Math.round(height * s.ratio) };
  return <img className="nivo-logo" src={s.src} alt={s.alt} style={style} />;
};
