import type { VideoWorkbenchScope } from "@modules/domain/video"
import type { GetVideoScopeRequest } from "../../application/get-video-scope.contracts"
import type { VideoScopeType } from "./dto/video-scope.type"

/** Maps the workspace selector into the application request. */
export const toGetVideoScopeRequest = (workspaceId: string): GetVideoScopeRequest => ({ workspaceId })

/** Maps the domain result into the GraphQL type. */
export const toGetVideoScopeType = (result: VideoWorkbenchScope): VideoScopeType => ({ ...result })
