import { Command } from "@nestjs/cqrs"
import type { CreateCvUploadOutput, CreateCvUploadParams } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** Asks for get a signed place to upload a CV. */
export class CreateHiringCvUploadCommand extends Command<CreateCvUploadOutput> {
    constructor(readonly params: PublicExecuteParams<CreateCvUploadParams>) {
        super()
    }
}
