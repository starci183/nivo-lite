import type { ContentMediaUpload } from "@modules/domain/content-media"
import type { RequestContentMediaUploadRequest } from "../../application/request-content-media-upload.contracts"
import type { RequestContentMediaUploadInput } from "./dto/request-content-media-upload.input"
import type { ContentMediaUploadType } from "./dto/content-media-upload.type"

/** Maps file metadata and the workspace selector to an upload request. */
export const toRequestContentMediaUploadRequest = (
    workspaceId: string,
    input: RequestContentMediaUploadInput,
): RequestContentMediaUploadRequest => ({
    workspaceId,
    name: input.name,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
})

/** Maps the upload address without moving bytes through GraphQL. */
export const toContentMediaUploadType = (result: ContentMediaUpload): ContentMediaUploadType => ({ ...result })
