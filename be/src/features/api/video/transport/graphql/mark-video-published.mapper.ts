import type { WorkbenchProject } from "@modules/domain/video"
import type { MarkVideoPublishedRequest } from "../../application/mark-video-published.contracts"
import type { MarkVideoPublishedInput } from "./dto/mark-video-published.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the workspace selector into the application request. */
export const toMarkVideoPublishedRequest = (
    workspaceId: string,
    input: MarkVideoPublishedInput,
): MarkVideoPublishedRequest => ({ workspaceId, projectId: input.projectId })

/** Maps the domain result into the GraphQL type. */
export const toMarkVideoPublishedType = (result: WorkbenchProject): VideoProjectType => toVideoProjectType(result)
