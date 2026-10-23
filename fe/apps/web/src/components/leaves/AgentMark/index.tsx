"use client"

import { IconTile } from "@starci/grammar/common"
import type { IconSource, IconTileSize } from "@starci/grammar/common"

/** What the square agent mark draws. */
type AgentMarkProps = {
    /** Accept legacy caller metadata while the mark renders only its visual props. */
    readonly [metadata: string]: unknown
    /** Module icon source resolved by the caller through the Icon leaf registry. */
    readonly glyph: IconSource
    /** The spoken name of the mark. */
    readonly label: string
    readonly size?: "xs" | "sm" | "md" | "lg" | undefined
}

/** IconTile publishes `sm` (32px) and `md` (40px) only; `lg` takes `md`, `xs` takes `sm`. */
const TILE_SIZE: Record<NonNullable<AgentMarkProps["size"]>, IconTileSize> = {
    xs: "sm",
    sm: "sm",
    md: "md",
    lg: "md",
}

/** An AI agent: the grammar's neutral `IconTile` with the module glyph, so an agent and a person are never confused. */
export const AgentMark = (props: AgentMarkProps) => (
    <IconTile source={props.glyph} tone="neutral" size={TILE_SIZE[props.size ?? "md"]} ariaLabel={props.label} />
)
