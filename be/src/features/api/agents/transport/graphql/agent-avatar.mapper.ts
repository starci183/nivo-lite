import type { AvatarUpload } from "@modules/domain/avatars"
import type { RequestAgentAvatarUploadRequest } from "../../application/request-agent-avatar-upload.contracts"
import type { SetAgentAvatarRequest } from "../../application/set-agent-avatar.contracts"
import type { AgentAvatarUploadType } from "./dto/agent-avatar-upload.type"
import type { RequestAgentAvatarUploadInput } from "./dto/request-agent-avatar-upload.input"
import type { SetAgentAvatarInput } from "./dto/set-agent-avatar.input"
import type { SetAgentAvatarPresetRequest } from "../../application/set-agent-avatar-preset.contracts"
import type { SetAgentAvatarPresetInput } from "./dto/set-agent-avatar-preset.input"

/** Maps the picture of the GraphQL input, with the workspace it names, to the upload request. */
export const toRequestAgentAvatarUploadRequest = (
    workspaceId: string,
    input: RequestAgentAvatarUploadInput,
): RequestAgentAvatarUploadRequest => ({ workspaceId, contentType: input.contentType, sizeBytes: input.sizeBytes })

/** Maps the upload address to the GraphQL type. */
export const toAgentAvatarUploadType = (upload: AvatarUpload): AgentAvatarUploadType => ({ ...upload })

/** Maps the picture change of the GraphQL input, with the workspace it names, to the command request. */
export const toSetAgentAvatarRequest = (workspaceId: string, input: SetAgentAvatarInput): SetAgentAvatarRequest => ({
    workspaceId,
    agentId: input.agentId,
    path: input.path,
})

/** Maps the GraphQL input, with the workspace it names, to the preset request. */
export const toSetAgentAvatarPresetRequest = (
    workspaceId: string,
    input: SetAgentAvatarPresetInput,
): SetAgentAvatarPresetRequest => ({ workspaceId, agentId: input.agentId, preset: input.preset })
