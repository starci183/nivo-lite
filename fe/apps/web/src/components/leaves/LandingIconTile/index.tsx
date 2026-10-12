"use client"

import { IconTile } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** A serialisable glyph name, so a server component can pass it. */
interface LandingIconTileProps {
    readonly name: IconName
}

/**
 * Neutral identity tile. The client boundary exists so a server component hands over a glyph NAME,
 * never a glyph function.
 */
export const LandingIconTile = (props: LandingIconTileProps) => (
    <IconTile source={nivoIconSource(props.name, "leading")} tone="neutral" size="sm" />
)
