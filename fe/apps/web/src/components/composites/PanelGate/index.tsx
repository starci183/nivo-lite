import type { ReactNode } from "react"
import { SurfaceListCard } from "@starci/grammar/common"

/** Props for {@link PanelGate}. */
export interface PanelGateProps {
    /** Where the gate stands: its blocks can draw, their data is still being read, or the blocks are not shown. */
    readonly state: "ready" | "pending" | "hidden"
    /** The name of the panel drawn as a skeleton while pending; null draws nothing meanwhile. */
    readonly placeholder: string | null
    /** The blocks behind the gate. */
    readonly content: ReactNode
}

/** Draws the blocks behind a gate once ready, the skeleton of their panel while pending, else nothing. */
export const PanelGate = (props: PanelGateProps) => {
    if (props.state === "ready") return props.content
    if (props.state === "pending" && props.placeholder !== null)
        return <SurfaceListCard ariaLabel={props.placeholder} isLoading />
    return null
}
