import { Command } from "@nestjs/cqrs"
import type { AvatarUpload } from "@modules/domain/avatars"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestAgentAvatarUploadRequest } from "./request-agent-avatar-upload.contracts"

/** Asks for a one-time address to upload an agent picture to. */
export class RequestAgentAvatarUploadCommand extends Command<AvatarUpload> {
    constructor(readonly params: ExecuteParams<RequestAgentAvatarUploadRequest>) {
        super()
    }
}
