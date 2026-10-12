"use client";

import { IconTile } from "@starci/grammar/common";
import { nivoIconSource, type IconName } from "@/ui";

/** Props for {@link LandingIconTile}: a serialisable glyph name, so Server Components can pass it. */
export type LandingIconTileProps = { readonly name: IconName };

/**
 * Neutral identity tile (ACCENT-2 case-1, ACCENT-6: an identity tile spends no accent). Client boundary only so a
 * Server Component hands over a glyph NAME, never a glyph function (see `NivoIcon`).
 */
export const LandingIconTile = ({ name }: LandingIconTileProps) => (
  <IconTile source={nivoIconSource(name, "leading")} tone="neutral" size="sm" />
);
