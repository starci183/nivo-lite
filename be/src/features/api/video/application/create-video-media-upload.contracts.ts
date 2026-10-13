import type { VideoMediaFile } from "@modules/domain/video"

/** Authenticated createVideoMediaUpload request. */
export interface CreateVideoMediaUploadRequest extends VideoMediaFile {
    /** Active workspace selector. */
    readonly workspaceId: string
}

/** Successful createVideoMediaUpload result. */
