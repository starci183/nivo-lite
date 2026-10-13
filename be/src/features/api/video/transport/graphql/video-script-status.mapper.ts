import type { VideoScriptStatus } from "@modules/domain/video"
import type { GetVideoScriptStatusRequest } from "../../application/get-video-script-status.contracts"
import type { VideoScriptStatusInput } from "./dto/video-script-status.input"
import type { VideoScriptStatusType } from "./dto/video-script-status.type"

/** Scopes one polling id to the selected workspace. */
export const toGetVideoScriptStatusRequest = (
    input: VideoScriptStatusInput,
    workspaceId: string,
): GetVideoScriptStatusRequest => ({ id: input.id, workspaceId })

/** Returns the terminal or in-flight state without a response envelope. */
export const toVideoScriptStatusType = (result: VideoScriptStatus): VideoScriptStatusType => ({ ...result })
