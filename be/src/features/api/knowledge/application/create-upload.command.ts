import { Command } from "@nestjs/cqrs"
import type { UploadAddress } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateUploadRequest } from "./create-upload.contracts"

/** Asks for an address a browser uploads one document to. */
export class CreateUploadCommand extends Command<UploadAddress> {
    constructor(readonly params: ExecuteParams<CreateUploadRequest>) {
        super()
    }
}
