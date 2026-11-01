import { Command } from "@nestjs/cqrs"
import type { ChatFileUpload } from "@modules/domain/chat-files"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestOfficeFileUploadRequest } from "./request-office-file-upload.contracts"

/** Requests an upload address for a file of an Office line in the caller's selected workspace. */
export class RequestOfficeFileUploadCommand extends Command<ChatFileUpload> {
    constructor(readonly params: ExecuteParams<RequestOfficeFileUploadRequest>) {
        super()
    }
}
