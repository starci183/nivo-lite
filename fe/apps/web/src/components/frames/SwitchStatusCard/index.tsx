import { SurfaceCard } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** The card's title and the switch drawn through the block's SlotView. */
interface SwitchStatusCardProps {
    readonly title: string
    readonly children: ReactNode
}

/** A settings card with one switch whose state comes from a read. */
export const SwitchStatusCard = (props: SwitchStatusCardProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        {props.children}
    </SurfaceCard>
)
