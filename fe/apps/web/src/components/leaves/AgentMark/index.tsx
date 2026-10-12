import { IconTile } from "@starci/grammar/common"
import type { IconSource, IconSourceProps, IconTileSize } from "@starci/grammar/common"

/** What the square agent mark draws. */
type AgentMarkProps = {
    /** SVG path data of the module glyph (24 by 24 grid, stroked). */
    readonly glyph: string
    /** The spoken name of the mark. */
    readonly label: string
    readonly module: string
    readonly size?: "xs" | "sm" | "md" | "lg"
}

/** IconTile publishes `sm` (32px) and `md` (40px) only; `lg` takes `md`, `xs` takes `sm`. */
const TILE_SIZE: Record<NonNullable<AgentMarkProps["size"]>, IconTileSize> = {
    xs: "sm",
    sm: "sm",
    md: "md",
    lg: "md",
}

/** One stable glyph component per path, so the grammar tile does not remount its icon on every render. */
const GLYPHS = new Map<string, IconSource>()

const glyphSource = (path: string): IconSource => {
    const cached = GLYPHS.get(path)
    if (cached) return cached
    const Glyph = (props: IconSourceProps) => (
        <svg viewBox="0 0 24 24" {...props}>
            <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
    GLYPHS.set(path, Glyph)
    return Glyph
}

/** An AI agent: the grammar's neutral `IconTile` with the module glyph, so an agent and a person are never confused. */
export const AgentMark = (props: AgentMarkProps) => (
    <IconTile
        source={glyphSource(props.glyph)}
        tone="neutral"
        size={TILE_SIZE[props.size ?? "md"]}
        ariaLabel={props.label}
    />
)
