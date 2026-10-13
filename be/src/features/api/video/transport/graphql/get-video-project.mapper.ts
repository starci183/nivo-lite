import type { WorkbenchProject } from "@modules/domain/video"
import type { GetVideoProjectRequest } from "../../application/get-video-project.contracts"
import type { GetVideoProjectInput } from "./dto/get-video-project.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the workspace selector into the application request. */
export const toGetVideoProjectRequest = (workspaceId: string, input: GetVideoProjectInput): GetVideoProjectRequest => ({
    workspaceId,
    projectId: input.projectId,
})

/** Maps the domain result into the GraphQL type. */
export const toGetVideoProjectType = (result: WorkbenchProject): VideoProjectType => toVideoProjectType(result)
