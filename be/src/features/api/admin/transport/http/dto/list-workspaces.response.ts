import type { AdminWorkspaceItem, WorkspaceFilter } from "@modules/domain/platform-admin"

/** The HTTP response of listWorkspaces. */
export class ListWorkspacesResponse {
    /** Every workspace, before any filter. */
    total!: number

    /** How many workspaces each filter keeps. */
    counts!: Readonly<Record<WorkspaceFilter, number>>

    /** The workspaces the filter and the search keep. */
    items!: ReadonlyArray<AdminWorkspaceItem>
}
