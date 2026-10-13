import type { WorkItemCursor, WorkStatus } from "@modules/domain/decisions"

/** What listing work items takes. */
export interface ListWorkItemPageRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only these statuses; empty means every status. */
    readonly statuses: ReadonlyArray<WorkStatus>
    /** Where the page starts; absent for the first page. */
    readonly after?: WorkItemCursor
    /** The page size, clamped to 1..100. */
    readonly limit: number
}
