import { useState } from "react"
import type { ReactNode } from "react"
import { Pane, PaneGrid } from "@starci/grammar/common"

/** What the frame of a provider connection page holds: the head band, the live rail and the bands of the main pane. */
interface ConnectionPaneFrameProps {
    /** The bands of the main pane. */
    readonly children: ReactNode
    /** The head band: content of the head pane. */
    readonly head: ReactNode
    /** The live rail: content of the aside pane, which is a drawer below 70rem. */
    readonly aside: ReactNode
    readonly gridLabel: string
    readonly mainLabel: string
    readonly rail: { readonly label: string; readonly openLabel: string; readonly closeLabel: string }
}

/**
 * The pane grid of a provider connection page, drawn inside the Connections frame (no `Page` of its own): the head over the main
 * pane, with the live rail as a third column from 70rem and a drawer below it. The connected head and rail blocks fill their panes.
 */
export const ConnectionPaneFrame = (props: ConnectionPaneFrameProps) => {
    const [isRailOpen, setRailOpen] = useState(false)
    return (
        <PaneGrid
            label={props.gridLabel}
            areas={{
                base: ["head", "main"],
                medium: ["head", "main"],
                wide: ["head aside", "main aside"],
            }}
            columns={{ base: ["fill"], medium: ["fill"], wide: ["fill", "standard"] }}
            rows={{ base: ["auto", "fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] }}
        >
            <Pane area="head" surface>
                {props.head}
            </Pane>
            <Pane area="main" surface scroll label={props.mainLabel}>
                {props.children}
            </Pane>
            <Pane
                area="aside"
                surface
                scroll
                label={props.rail.label}
                collapse="drawer"
                collapseLabel={props.rail.label}
                openLabel={props.rail.openLabel}
                closeLabel={props.rail.closeLabel}
                isOpen={isRailOpen}
                onOpenChange={setRailOpen}
            >
                {props.aside}
            </Pane>
        </PaneGrid>
    )
}
