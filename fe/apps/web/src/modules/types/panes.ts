import type { PaneGridProps, PaneTrack } from "@starci/grammar/common"

/** The grid props a console page's pane arrangement decides: the areas and the tracks at each width. */
export interface PaneGridLayout {
    readonly areas: Exclude<PaneGridProps["areas"], ReadonlyArray<string>>
    readonly columns: Exclude<NonNullable<PaneGridProps["columns"]>, ReadonlyArray<PaneTrack>>
    readonly rows: Exclude<NonNullable<PaneGridProps["rows"]>, ReadonlyArray<PaneTrack>>
}
