import type { WorkbenchProject } from "@modules/domain/video"

/** Authenticated videoProjects request. */
export interface ListVideoProjectsRequest {
    /** Active workspace selector. */
    readonly workspaceId: string
    /** Include archived projects. */
    readonly includeArchived?: boolean
}

/** Successful videoProjects result. */
export type ListVideoProjectsResult = ReadonlyArray<WorkbenchProject>
