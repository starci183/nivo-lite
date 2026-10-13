import type { ListVideoSourcesRequest, ListVideoSourcesResult } from "../../application/list-video-sources.contracts"
import type { VideoSourceType } from "./dto/video-source.type"

/** Maps the workspace selector into the application request. */
export const toListVideoSourcesRequest = (workspaceId: string): ListVideoSourcesRequest => ({ workspaceId })

/** Maps the domain result into the GraphQL type. */
export const toListVideoSourcesType = (result: ListVideoSourcesResult): Array<VideoSourceType> =>
    result.map((entry) => ({ ...entry }))
