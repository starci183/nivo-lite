import type { WorkspaceMenuView } from "./workspaces-menu"

/** Where a workspace stands for the person: usable, waiting for payment, switched off for them, just joined, or deleted by them (its owner). */
export type WorkspaceTableStatus = "active" | "pending" | "disabled" | "new" | "deleted"

/** What the row action does: open the workspace, lead to its payment, explain why access is off, or restore it. */
export type WorkspaceTableAction = "open" | "pay" | "showReason" | "restore"

/** One workspace row, already worded for the person's language. */
export interface WorkspaceTableRowView {
    readonly id: string
    readonly name: string
    readonly status: WorkspaceTableStatus
    /** The line under the name: role, plan and people, joined by the container. */
    readonly meta: string
    /** When the person last opened it, as a short phrase; empty when never. */
    readonly lastOpened: string
    /** The most recently opened row carries the primary action. */
    readonly isPrimary: boolean
    readonly isBusy: boolean
    /** The words of the row's ⋯ menu and which commands the person may give. */
    readonly menu: WorkspaceMenuView
    /** The line the phone sheet shows under the name: role and plan. */
    readonly identity: string
}

/** A command of a row's ⋯ menu. */
export type WorkspaceMenuCommand = "open" | "billing" | "rename" | "copyLink" | "leave" | "delete"

/** The rows of the table, the value of its slot. */
export interface WorkspacesTableData {
    readonly rows: ReadonlyArray<WorkspaceTableRowView>
}

/** Every word the table draws, resolved by the container. */
export interface WorkspacesTableCopy {
    readonly title: string
    readonly tableLabel: string
    readonly columns: {
        readonly workspace: string
        readonly status: string
        readonly lastOpened: string
        readonly action: string
        readonly more: string
    }
    readonly statuses: Readonly<Record<WorkspaceTableStatus, string>>
    readonly actions: Readonly<Record<WorkspaceTableAction, string>>
}
