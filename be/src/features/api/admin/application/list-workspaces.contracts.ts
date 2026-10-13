import type { AdminWorkspaceList, WorkspaceFilter } from "@modules/domain/platform-admin"

/** What listWorkspaces takes. */
export interface ListWorkspacesRequest {
    /** Which workspaces to keep. */
    readonly filter: WorkspaceFilter
    /** Free text matched against the name, the owner's email and the start of the id. */
    readonly query: string
}

/** What listWorkspaces answers. */
export type ListWorkspacesResult = Readonly<AdminWorkspaceList>
