import type { VideoMediaTicket } from "@modules/domain/video"
import type { CreateVideoMediaUploadRequest } from "../../application/create-video-media-upload.contracts"
import type { CreateVideoMediaUploadInput } from "./dto/create-video-media-upload.input"
import type { VideoMediaUploadType } from "./dto/video-media-upload.type"

/** Maps the workspace selector into the application request. */
export const toCreateVideoMediaUploadRequest = (
    workspaceId: string,
    input: CreateVideoMediaUploadInput,
): CreateVideoMediaUploadRequest => ({
    workspaceId,
    name: input.name,
    type: input.type,
    size: input.size,
})

/** Maps the domain result into the GraphQL type. */
export const toCreateVideoMediaUploadType = (result: VideoMediaTicket): VideoMediaUploadType => ({
    ...result,
})
