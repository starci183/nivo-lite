import type { RenderStatus } from "@modules/domain/video-renders"
import type { GetRenderStatusRequest } from "../../application/get-render-status.contracts"
import type { VideoRenderStatusInput } from "./dto/get-render-status.input"
import type { VideoRenderStatusType } from "./dto/get-render-status.type"

/** Maps the selected workspace and render to the status query. */
export const toGetRenderStatusRequest = (
    workspaceId: string,
    input: VideoRenderStatusInput,
): GetRenderStatusRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps public render progress and outputs to the GraphQL type. */
export const toVideoRenderStatusType = (result: RenderStatus): VideoRenderStatusType => ({ ...result })
