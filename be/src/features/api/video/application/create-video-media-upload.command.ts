import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { VideoMediaTicket } from "@modules/domain/video"
import type { CreateVideoMediaUploadRequest } from "./create-video-media-upload.contracts"

/** The authenticated createVideoMediaUpload operation. */
export class CreateVideoMediaUploadCommand extends Command<VideoMediaTicket> {
    constructor(readonly params: ExecuteParams<CreateVideoMediaUploadRequest>) {
        super()
    }
}
