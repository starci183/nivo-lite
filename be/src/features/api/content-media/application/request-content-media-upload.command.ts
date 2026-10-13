import { Command } from "@nestjs/cqrs"
import type { ContentMediaUpload } from "@modules/domain/content-media"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestContentMediaUploadRequest } from "./request-content-media-upload.contracts"

/** Asks for the address a browser uploads a workspace media file to. */
export class RequestContentMediaUploadCommand extends Command<ContentMediaUpload> {
    constructor(readonly params: ExecuteParams<RequestContentMediaUploadRequest>) {
        super()
    }
}
