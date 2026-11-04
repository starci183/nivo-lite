import type { PaneGridProps, PaneTrack } from "@starci/grammar/common"

/** The grid props a console page's pane arrangement decides: the areas and the tracks at each width. */
export interface PaneGridLayout {
    readonly areas: Exclude<PaneGridProps["areas"], ReadonlyArray<string>>
    readonly columns: Exclude<NonNullable<PaneGridProps["columns"]>, ReadonlyArray<PaneTrack>>
    readonly rows: Exclude<NonNullable<PaneGridProps["rows"]>, ReadonlyArray<PaneTrack>>
}

/** The side pane of a workbench (the decisions waiting for the owner, or the explanation of one) as its connected owner resolves it. */
export interface WorkbenchAsideView {
    /** The areas and tracks of the workbench grid: the main pane beside the side pane, or one of them alone. */
    readonly grid: PaneGridLayout
    /** The owner closed the side pane: the way to open it again stays in the main pane at every width. */
    readonly isHidden: boolean
    /** The words of the controls of the two panes' heads. */
    readonly copy: {
        readonly grid: string
        readonly close: string
        readonly back: string
    }
}

/** The commands of the side pane of a workbench. */
export interface WorkbenchAsideActions {
    /** Opens the side pane: the one pane a phone shows, the second pane a wider grid shows. */
    readonly open: () => void
    /** Closes the side pane. */
    readonly close: () => void
}
