import type { VideoScriptRequest } from "@modules/domain/video"
import type { RequestVideoScriptRequest } from "../../application/request-video-script.contracts"
import type { RequestVideoScriptInput } from "./dto/request-video-script.input"
import type { RequestVideoScriptType } from "./dto/request-video-script.type"

/** Combines the validated input with the active workspace selection. */
export const toRequestVideoScriptRequest = (
    input: RequestVideoScriptInput,
    workspaceId: string,
): RequestVideoScriptRequest => ({ projectId: input.projectId, workspaceId })

/** Returns the unwrapped polling operation. */
export const toRequestVideoScriptType = (result: VideoScriptRequest): RequestVideoScriptType => ({ ...result })
