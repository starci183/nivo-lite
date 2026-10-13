import type { VideoShareResult } from "@modules/domain/video"
import type { ShareVideoProjectRequest } from "../../application/share-video-project.contracts"
import type { ShareVideoProjectInput } from "./dto/share-video-project.input"
import type { VideoShareType } from "./dto/video-share.type"

/** Maps the project selector to the application request. */
export const toShareVideoProjectRequest = (
    workspaceId: string,
    input: ShareVideoProjectInput,
): ShareVideoProjectRequest => ({ workspaceId, projectId: input.projectId })

/** Maps the successful result to its GraphQL view. */
export const toShareVideoProjectType = (result: VideoShareResult): VideoShareType => ({ ...result })
