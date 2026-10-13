import type { ListVideoProjectsRequest, ListVideoProjectsResult } from "../../application/list-video-projects.contracts"
import type { ListVideoProjectsInput } from "./dto/list-video-projects.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the workspace selector into the application request. */
export const toListVideoProjectsRequest = (
    workspaceId: string,
    input: ListVideoProjectsInput,
): ListVideoProjectsRequest => ({ workspaceId, includeArchived: input.includeArchived })

/** Maps the domain result into the GraphQL type. */
export const toListVideoProjectsType = (result: ListVideoProjectsResult): Array<VideoProjectType> =>
    result.map(toVideoProjectType)
