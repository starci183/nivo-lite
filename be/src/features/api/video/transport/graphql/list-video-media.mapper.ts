import type { ListVideoMediaRequest, ListVideoMediaResult } from "../../application/list-video-media.contracts"
import type { VideoMediaType } from "./dto/video-media.type"

/** Maps the workspace selector into the application request. */
export const toListVideoMediaRequest = (workspaceId: string): ListVideoMediaRequest => ({ workspaceId })

/** Maps the domain result into the GraphQL type. */
export const toListVideoMediaType = (result: ListVideoMediaResult): Array<VideoMediaType> =>
    result.map((entry) => ({ ...entry }))
