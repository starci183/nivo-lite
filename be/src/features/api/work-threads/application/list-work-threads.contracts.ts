import type { PageRequest } from "@modules/platform/pagination"

/** What the ListWorkThreads operation takes. */
export interface ListWorkThreadsRequest extends PageRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only threads about this lead; absent or null lists every thread. */
    readonly leadId?: string | null | undefined
}
