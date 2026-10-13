import type { ReactNode } from "react"
import { SurfaceCard } from "@starci/grammar/common"
import { ANCHOR_CLASS_NAME } from "./classNames"

/** A titled card of the lead page that a link can jump to. */
type LeadPanelProps = {
    readonly anchor: string
    readonly label: string
    readonly children: ReactNode
}

/** One panel of the lead page: an anchor around a card with its heading. */
export const LeadPanel = (props: LeadPanelProps) => (
    <div id={props.anchor} className={ANCHOR_CLASS_NAME}>
        <SurfaceCard label={props.label} headingLevel={2}>
            {props.children}
        </SurfaceCard>
    </div>
)
