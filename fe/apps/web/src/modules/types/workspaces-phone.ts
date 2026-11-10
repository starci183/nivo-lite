import type { WorkspaceMenuView } from "./workspaces-menu"
import type { WorkspacesTableCopy } from "./workspaces-table"

/** Every word the phone stack draws: the heading and the list name, then the badge and action words shared with the table. */
export interface WorkspacesStackCopy {
    readonly title: string
    readonly statuses: WorkspacesTableCopy["statuses"]
    readonly actions: WorkspacesTableCopy["actions"]
    /** The accessible name of a row sheet's close control. */
    readonly sheetClose: string
}

/** What the phone bottom sheet of one workspace shows: who it is, the menu words and the close name. */
export interface WorkspaceRowSheetView {
    readonly id: string
    readonly isOpen: boolean
    readonly name: string
    /** The line under the name: role and plan. */
    readonly meta: string
    /** The accessible name of the sheet close control. */
    readonly closeLabel: string
    readonly menu: WorkspaceMenuView
}
