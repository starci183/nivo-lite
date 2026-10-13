import type { VideoSourceChoice } from "@modules/domain/video"

/** Authenticated videoSources request. */
export interface ListVideoSourcesRequest {
    /** Active workspace selector. */
    readonly workspaceId: string
}

/** Successful videoSources result. */
export type ListVideoSourcesResult = ReadonlyArray<VideoSourceChoice>
