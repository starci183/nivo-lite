import type { WorkbenchProjectPatch } from "@modules/domain/video"

/** Authenticated updateVideoProject request. */
export interface UpdateVideoProjectRequest extends WorkbenchProjectPatch {
    /** Active workspace selector. */
    readonly workspaceId: string
    /** projectId selector. */
    readonly projectId: string
}

/** Successful updateVideoProject result. */
