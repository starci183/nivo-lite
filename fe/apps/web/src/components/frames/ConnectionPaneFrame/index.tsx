import type { ReactNode } from "react"
import { Pane, PaneGrid } from "@starci/grammar/common"

/** What the frame of a provider connection page holds: the head band, the bands of the main pane and, when the provider has one, the live rail. */
interface ConnectionPaneFrameProps {
    /** The bands of the main pane. */
    readonly children: ReactNode
    /** The head band: content of the head pane. */
    readonly head: ReactNode
    /** The live rail: content of the aside pane, which is a drawer below 70rem; none for a provider without one. */
    readonly aside?: ReactNode
    readonly gridLabel: string
    readonly mainLabel: string
    /** The names of the rail pane and its close button; only with an aside. */
    readonly rail?: { readonly label: string; readonly closeLabel: string }
}

/**
 * The pane grid of a provider connection page, drawn inside the Connections frame (no `Page` of its own): the head over the main
 * pane, with the live rail as a third column from 70rem and a drawer below it. The connected head and rail blocks fill their panes.
 */
export const ConnectionPaneFrame = (props: ConnectionPaneFrameProps) => {
    const hasRail = props.aside !== undefined && props.rail !== undefined
    return (
        <PaneGrid
            label={props.gridLabel}
            areas={{
                base: ["head", "main"],
                medium: ["head", "main"],
                wide: hasRail ? ["head aside", "main aside"] : ["head", "main"],
            }}
            columns={{ base: ["fill"], medium: ["fill"], wide: hasRail ? ["fill", "standard"] : ["fill"] }}
            rows={{ base: ["auto", "fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] }}
        >
            <Pane area="head" surface>
                {props.head}
            </Pane>
            <Pane area="main" surface scroll label={props.mainLabel}>
                {props.children}
            </Pane>
            {props.aside === undefined || props.rail === undefined ? null : (
                <Pane
                    area="aside"
                    surface
                    scroll
                    label={props.rail.label}
                    collapse="drawer"
                    trigger="head"
                    collapseLabel={props.rail.label}
                    closeLabel={props.rail.closeLabel}
                >
                    {props.aside}
                </Pane>
            )}
        </PaneGrid>
    )
}
