import type { VideoMediaItem } from "@modules/domain/video"

/** Authenticated videoMedia request. */
export interface ListVideoMediaRequest {
    /** Active workspace selector. */
    readonly workspaceId: string
}

/** Successful videoMedia result. */
export type ListVideoMediaResult = ReadonlyArray<VideoMediaItem>
