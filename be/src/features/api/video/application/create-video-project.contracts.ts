import type { NewWorkbenchProject } from "@modules/domain/video"

/** Authenticated createVideoProject request. */
export interface CreateVideoProjectRequest extends NewWorkbenchProject {
    /** Active workspace selector. */
    readonly workspaceId: string
}

/** Successful createVideoProject result. */
