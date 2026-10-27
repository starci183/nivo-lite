import { IconTile } from "@starci/grammar/common"
import type { IconTileTone } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** Semantic state carried by the tile: resting, running or needing attention. */
type TileIconSignal = "none" | "active" | "attention"

/** What the console tile mark draws. */
type TileIconProps = {
    readonly props: { readonly icon: IconName; readonly signal?: TileIconSignal }
    readonly isSkeleton?: boolean
}

const TONES: Record<TileIconSignal, IconTileTone> = { none: "accent", active: "success", attention: "warning" }

/** The 40px console tile: the grammar icon plate, its tone carrying the state a corner dot used to carry. */
export const TileIcon = (props: TileIconProps) => (
    <IconTile
        source={nivoIconSource(props.props.icon, "leading")}
        tone={TONES[props.props.signal ?? "none"]}
        size="md"
        isSkeleton={props.isSkeleton ?? false}
    />
)
