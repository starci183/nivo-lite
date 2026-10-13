import type { WorkbenchProject } from "@modules/domain/video"
import type { ApproveVideoProjectRequest } from "../../application/approve-video-project.contracts"
import type { ApproveVideoProjectInput } from "./dto/approve-video-project.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the project selector to the application request. */
export const toApproveVideoProjectRequest = (
    workspaceId: string,
    input: ApproveVideoProjectInput,
): ApproveVideoProjectRequest => ({ workspaceId, projectId: input.projectId })

/** Maps the successful result to its GraphQL view. */
export const toApproveVideoProjectType = (result: WorkbenchProject): VideoProjectType => toVideoProjectType(result)
