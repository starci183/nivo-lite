import { Command } from "@nestjs/cqrs"
import type { AvatarUpload } from "@modules/domain/avatars"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestMyAvatarUploadRequest } from "./request-my-avatar-upload.contracts"

/** Asks for a one-time address to upload the caller's own picture to. */
export class RequestMyAvatarUploadCommand extends Command<AvatarUpload> {
    constructor(readonly params: ExecuteParams<RequestMyAvatarUploadRequest>) {
        super()
    }
}
