import { Command } from "@nestjs/cqrs"
import type { CreateCvUploadOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CreateHiringCvUploadRequest } from "./create-hiring-cv-upload.contracts"

/** Asks for get a signed place to upload a CV. */
export class CreateHiringCvUploadCommand extends Command<CreateCvUploadOutput> {
    constructor(readonly params: PublicExecuteParams<CreateHiringCvUploadRequest>) {
        super()
    }
}
