import type { ReactNode } from "react"
import { Pane, PaneGrid } from "@starci/grammar/common"
import type { PaneGridLayout } from "@/modules/types"

/** The five bands of the automations panes, each already drawn by the block that owns the data. */
interface AutomationPanesProps {
    readonly label: string
    /** An automation is opened: a phone shows it instead of the list. */
    readonly isOpen: boolean
    readonly list: ReactNode
    readonly head: ReactNode
    readonly main: ReactNode
    readonly runsHead: ReactNode
    readonly runs: ReactNode
}

/** The arrangement: the list beside the opened automation and its runs; a phone shows the list, or the opened automation alone. */
const gridOf = (isOpen: boolean): PaneGridLayout => ({
    areas: {
        base: isOpen ? ["head", "main"] : ["list"],
        medium: ["list head", "list main"],
        wide: ["list head asideHead", "list main aside"],
    },
    columns: { base: ["fill"], medium: ["wide", "fill"], wide: ["wide", "fill", "standard"] },
    rows: { base: isOpen ? ["auto", "fill"] : ["fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] },
})

/**
 * The automations as three panes (pane-grid.choose.frame): the list with its search and filter, the opened automation with its head
 * and sections, and its recent runs. The list spans the height; the heads sit over their bodies.
 */
export const AutomationPanes = (props: AutomationPanesProps) => {
    const grid = gridOf(props.isOpen)
    return (
        <PaneGrid label={props.label} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
            <Pane area="list" surface scroll label={props.label}>
                {props.list}
            </Pane>
            <Pane area="head" surface>
                {props.head}
            </Pane>
            <Pane area="main" scroll label={props.label}>
                {props.main}
            </Pane>
            <Pane area="asideHead" surface>
                {props.runsHead}
            </Pane>
            <Pane area="aside" scroll surface label={props.label}>
                {props.runs}
            </Pane>
        </PaneGrid>
    )
}
