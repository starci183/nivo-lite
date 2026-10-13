import type { WorkbenchProject } from "@modules/domain/video"
import type { ArchiveVideoProjectRequest } from "../../application/archive-video-project.contracts"
import type { ArchiveVideoProjectInput } from "./dto/archive-video-project.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the workspace selector into the application request. */
export const toArchiveVideoProjectRequest = (
    workspaceId: string,
    input: ArchiveVideoProjectInput,
): ArchiveVideoProjectRequest => ({
    workspaceId,
    projectId: input.projectId,
    archived: input.archived,
})

/** Maps the domain result into the GraphQL type. */
export const toArchiveVideoProjectType = (result: WorkbenchProject): VideoProjectType => toVideoProjectType(result)
