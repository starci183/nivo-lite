import type { WorkbenchProject } from "@modules/domain/video"
import type { DuplicateVideoProjectRequest } from "../../application/duplicate-video-project.contracts"
import type { DuplicateVideoProjectInput } from "./dto/duplicate-video-project.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the workspace selector into the application request. */
export const toDuplicateVideoProjectRequest = (
    workspaceId: string,
    input: DuplicateVideoProjectInput,
): DuplicateVideoProjectRequest => ({ workspaceId, projectId: input.projectId })

/** Maps the domain result into the GraphQL type. */
export const toDuplicateVideoProjectType = (result: WorkbenchProject): VideoProjectType => toVideoProjectType(result)
